import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/supabase';
import type {
  CheckoutPayload,
  CheckoutResult,
  OrderItemWithFiles,
  PageCountMethod,
  PaymentMethod,
  PricingCalculationInput,
} from '@/types/index';
import { validateAndRecalculate } from '@/lib/pricing/checkout-validator';
import { loadSystemConfig } from './config';
import type { WhatsAppOrderInput } from './whatsapp';
import { buildWhatsAppMessage, buildWhatsAppUrl } from './whatsapp';
import { loadAuthorizedReadyFiles } from '@/lib/upload/access';
import type { AuthorizedCheckoutFile } from '@/lib/upload/access';

interface ProcessedOrderItem {
  id: string;
  order_id: string;
  service_id: string | null;
  product_id: string | null;
  service_name_snapshot: string | null;
  service_description_snapshot: string | null;
  product_name_snapshot: string | null;
  fields_snapshot: Json;
  quantity: number;
  pages_count: number;
  pages_method: PageCountMethod;
  is_double_sided: boolean;
  unit_price_cents: number;
  total_price_cents: number;
  pricing_rule_id: string | null;
  pricing_rule_snapshot: Json | null;
  discount_cents: number;
  file_ids: string[];
}

function toJson(value: object): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function requireConfigInteger(config: Record<string, string>, key: string): number {
  const value = Number(config[key]);
  if (!Number.isSafeInteger(value)) throw new Error(`CONFIG_UNAVAILABLE: ${key}`);
  return value;
}

function major(cents: number): number {
  return cents / 100;
}

function checkoutActorHash(userId: string | undefined, guestEmail: string | null): string {
  const actor = userId ? `user:${userId}` : `guest:${guestEmail || ''}`;
  return crypto.createHash('sha256').update(actor).digest('hex');
}

function checkoutRequestHash(
  payload: CheckoutPayload,
  userId: string | undefined,
  guestEmail: string | null,
): string {
  const canonical = {
    actor: userId ? { userId } : { guestEmail },
    items: payload.items.map((item) => ({
      serviceId: item.serviceId || null,
      productId: item.productId || null,
      attributeIds: [...item.attributeIds].sort(),
      fieldValues: [...item.fieldValues]
        .map(({ fieldKey, value }) => ({ fieldKey, value }))
        .sort((left, right) => left.fieldKey.localeCompare(right.fieldKey)),
      isFrontAndBack: item.isFrontAndBack,
      quantity: item.quantity,
      fileIds: [...item.fileIds].sort(),
    })),
    deliveryType: payload.deliveryType,
    deliveryAddressId: payload.deliveryAddressId || null,
    deliveryAddress: payload.deliveryAddress || null,
    customerName: payload.customerName?.trim() || null,
    customerPhone: payload.customerPhone?.trim() || null,
    paymentMethod: payload.paymentMethod,
    notes: payload.notes?.trim() || null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export async function processCheckout(
  payload: CheckoutPayload,
  context: { userId?: string; guestEmail?: string; guestUploadSessionHash?: string },
  supabase: SupabaseClient<Database>
): Promise<CheckoutResult> {
  const config = await loadSystemConfig(supabase, [
    'pix_key',
    'pix_owner_name',
    'whatsapp_number',
    'delivery_fee_cents',
    'delivery_city',
    'delivery_state',
    'delivery_enabled',
    'pickup_enabled',
    'guest_order_access_days',
  ]);

  let customerName = payload.customerName?.trim() || null;
  let customerPhone = payload.customerPhone?.trim() || null;
  const guestEmail = context.userId
    ? null
    : context.guestEmail?.trim().toLowerCase()
      || payload.guestEmail?.trim().toLowerCase()
      || null;

  if (context.userId && (!customerName || !customerPhone)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', context.userId)
      .maybeSingle();
    if (profile) {
      customerName ||= profile.full_name?.trim() || null;
      customerPhone ||= profile.phone?.trim() || null;
    }
  }

  let deliveryAddressSnapshot: string | null = null;
  if (payload.deliveryType === 'delivery' && config.delivery_enabled !== 'true') {
    throw new Error('DELIVERY_UNAVAILABLE');
  }
  if (payload.deliveryType === 'pickup' && config.pickup_enabled !== 'true') {
    throw new Error('PICKUP_UNAVAILABLE');
  }
  if (payload.deliveryType === 'delivery') {
    if (payload.deliveryAddress) {
      deliveryAddressSnapshot = JSON.stringify(payload.deliveryAddress);
    } else if (payload.deliveryAddressId && context.userId) {
      const { data: address } = await supabase
        .from('addresses')
        .select('street, number, complement, neighborhood, city, state, zip_code')
        .eq('id', payload.deliveryAddressId)
        .eq('user_id', context.userId)
        .maybeSingle();
      if (address) {
        deliveryAddressSnapshot = JSON.stringify({
          street: address.street,
          number: address.number,
          complement: address.complement ?? undefined,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zipCode: address.zip_code,
        });
      }
    }
    if (!deliveryAddressSnapshot) throw new Error('DELIVERY_ADDRESS_REQUIRED');
    const parsedAddress = JSON.parse(deliveryAddressSnapshot) as { city?: string; state?: string };
    if (!config.delivery_city || !/^[A-Z]{2}$/.test(config.delivery_state || '')
        || parsedAddress.city !== config.delivery_city || parsedAddress.state !== config.delivery_state) {
      throw new Error('DELIVERY_AREA_UNAVAILABLE');
    }
  }

  const actorHash = checkoutActorHash(context.userId, guestEmail);
  const requestHash = checkoutRequestHash(payload, context.userId, guestEmail);
  const { data: existing } = await supabase
    .from('orders')
    .select('id, order_number, order_token, subtotal_cents, delivery_fee_cents, total_cents, payment_method, checkout_request_hash')
    .eq('checkout_actor_hash', actorHash)
    .eq('idempotency_key', payload.idempotencyKey)
    .maybeSingle();

  if (existing) {
    if (existing.checkout_request_hash !== requestHash) throw new Error('IDEMPOTENCY_CONFLICT');
    const { data: persistedItems, error: persistedItemsError } = await supabase
      .from('order_items')
      .select('id, order_id, service_id, product_id, service_name_snapshot, service_description_snapshot, product_name_snapshot, quantity, pages_count, pages_method, unit_price_cents, total_price_cents, discount_cents, fields_snapshot, pricing_rule_snapshot')
      .eq('order_id', existing.id);
    if (persistedItemsError) throw new Error('ORDER_ITEMS_UNAVAILABLE');

    const replayItems: OrderItemWithFiles[] = (persistedItems || []).map((item) => ({
      id: item.id,
      orderId: item.order_id,
      serviceId: item.service_id,
      productId: item.product_id,
      serviceNameSnapshot: item.service_name_snapshot,
      serviceDescriptionSnapshot: item.service_description_snapshot,
      productNameSnapshot: item.product_name_snapshot,
      quantity: item.quantity,
      pageCount: item.pages_count,
      basePrice: major(item.unit_price_cents),
      totalPrice: major(item.total_price_cents),
      discountApplied: major(item.discount_cents),
      fieldsSnapshot: item.fields_snapshot && typeof item.fields_snapshot === 'object'
        ? item.fields_snapshot
        : {},
      pricingRuleSnapshot: item.pricing_rule_snapshot
        && typeof item.pricing_rule_snapshot === 'object'
        && !Array.isArray(item.pricing_rule_snapshot)
        ? item.pricing_rule_snapshot
        : null,
      files: [],
    }));
    const hasEstimates = (persistedItems || []).some((item) => item.pages_method !== 'exact');
    const replayMessage = buildWhatsAppMessage({
      orderNumber: existing.order_number,
      customerName,
      customerPhone,
      deliveryType: payload.deliveryType,
      paymentMethod: existing.payment_method,
      subtotal: major(existing.subtotal_cents),
      deliveryFee: major(existing.delivery_fee_cents),
      total: major(existing.total_cents),
      hasEstimates,
    }, replayItems);
    return {
      orderId: existing.id,
      orderNumber: existing.order_number,
      orderCode: existing.order_token,
      total: major(existing.total_cents),
      hasEstimates,
      paymentMethod: existing.payment_method as PaymentMethod,
      whatsappUrl: buildWhatsAppUrl(replayMessage, config.whatsapp_number || ''),
    };
  }

  const allFileIds = payload.items.flatMap((item) => item.fileIds);
  const uniqueFileIds = Array.from(new Set(allFileIds));
  if (uniqueFileIds.length !== allFileIds.length) throw new Error('FILE_ACCESS_DENIED');

  const filesById = new Map<string, AuthorizedCheckoutFile>();
  if (uniqueFileIds.length > 0) {
    const files = await loadAuthorizedReadyFiles(supabase, uniqueFileIds, context);
    for (const file of files) {
      filesById.set(file.id, file);
    }
  }

  const presentationOrderId = crypto.randomUUID();
  const processedItems: ProcessedOrderItem[] = [];
  let subtotalCents = 0;

  for (const item of payload.items) {
    if (item.productId) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('name, description, price_cents, stock_quantity')
        .eq('id', item.productId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (productError || !product) throw new Error('QUOTE_UNAVAILABLE: Produto inexistente ou inativo.');
      if (product.stock_quantity !== null && product.stock_quantity < item.quantity) {
        throw new Error('QUOTE_UNAVAILABLE: Estoque insuficiente.');
      }

      const totalPriceCents = product.price_cents * item.quantity;
      processedItems.push({
        id: crypto.randomUUID(),
        order_id: presentationOrderId,
        service_id: null,
        product_id: item.productId,
        service_name_snapshot: null,
        service_description_snapshot: product.description,
        product_name_snapshot: product.name,
        fields_snapshot: {},
        quantity: item.quantity,
        pages_count: 0,
        pages_method: 'exact',
        is_double_sided: false,
        unit_price_cents: product.price_cents,
        total_price_cents: totalPriceCents,
        pricing_rule_id: null,
        pricing_rule_snapshot: null,
        discount_cents: 0,
        file_ids: [],
      });
      subtotalCents += totalPriceCents;
      continue;
    }

    if (!item.serviceId) throw new Error('QUOTE_UNAVAILABLE: Item sem referência.');
    const itemFiles = item.fileIds.map((fileId) => filesById.get(fileId)).filter((file): file is AuthorizedCheckoutFile => Boolean(file));
    if (itemFiles.length !== item.fileIds.length) throw new Error('FILE_ACCESS_DENIED');
    const pageCount = itemFiles.length > 0
      ? itemFiles.reduce((sum, file) => sum + Math.max(1, file.page_count), 0)
      : 1;
    const pageMethod: PageCountMethod = itemFiles.some((file) => file.page_count_method !== 'exact')
      ? 'estimated'
      : 'exact';

    const pricingInput: PricingCalculationInput = {
      serviceId: item.serviceId,
      attributeIds: item.attributeIds,
      fieldValues: item.fieldValues,
      pageCount,
      isFrontAndBack: item.isFrontAndBack,
      quantity: item.quantity,
      fileIds: item.fileIds,
    };
    const pricingResult = await validateAndRecalculate(pricingInput, supabase);
    if (!pricingResult.success) throw new Error(`${pricingResult.error.code}: ${pricingResult.error.message}`);

    const quote = pricingResult.data;
    const pricingSnapshot = toJson({
      schemaVersion: 1,
      ...quote,
    });
    const fieldsSnapshot = toJson(quote.fieldsSnapshot);
    const description = quote.fieldsSnapshot
      .map((field) => `${field.fieldLabel}: ${field.valueLabel}`)
      .join(', ');

    processedItems.push({
      id: crypto.randomUUID(),
      order_id: presentationOrderId,
      service_id: item.serviceId,
      product_id: null,
      service_name_snapshot: quote.serviceSnapshot.name,
      service_description_snapshot: description || quote.serviceSnapshot.description,
      product_name_snapshot: null,
      fields_snapshot: fieldsSnapshot,
      quantity: item.quantity,
      pages_count: pageCount,
      pages_method: pageMethod,
      is_double_sided: item.isFrontAndBack,
      unit_price_cents: quote.unitPriceCents,
      total_price_cents: quote.totalCents,
      pricing_rule_id: quote.ruleId,
      pricing_rule_snapshot: pricingSnapshot,
      discount_cents: quote.discountCents,
      file_ids: item.fileIds,
    });
    subtotalCents += quote.totalCents;
  }

  const deliveryFeeCents = payload.deliveryType === 'delivery'
    ? requireConfigInteger(config, 'delivery_fee_cents')
    : 0;
  const totalCents = subtotalCents + deliveryFeeCents;

  const filesForWhatsApp = Array.from(filesById.values());
  const itemsForWhatsApp: OrderItemWithFiles[] = processedItems.map((item) => ({
    id: item.id,
    orderId: item.order_id,
    serviceId: item.service_id,
    productId: item.product_id,
    serviceNameSnapshot: item.service_name_snapshot,
    serviceDescriptionSnapshot: item.service_description_snapshot,
    productNameSnapshot: item.product_name_snapshot,
    quantity: item.quantity,
    pageCount: item.pages_count,
    basePrice: major(item.unit_price_cents),
    totalPrice: major(item.total_price_cents),
    discountApplied: major(item.discount_cents),
    fieldsSnapshot: Array.isArray(item.fields_snapshot) ? item.fields_snapshot : {},
    pricingRuleSnapshot: item.pricing_rule_snapshot
      && typeof item.pricing_rule_snapshot === 'object'
      && !Array.isArray(item.pricing_rule_snapshot)
      ? item.pricing_rule_snapshot
      : null,
    files: item.file_ids.map((fileId) => {
      const file = filesForWhatsApp.find((candidate) => candidate.id === fileId);
      return {
        id: fileId,
        originalName: file?.original_name || 'Arquivo',
        pageCountMethod: file?.page_count_method || 'exact',
      };
    }),
  }));

  const deliveryFee = major(deliveryFeeCents);
  const subtotal = major(subtotalCents);
  const total = major(totalCents);
  const pixKeyUsed = payload.paymentMethod === 'pix' ? (config.pix_key || null) : null;

  const { data: committedRows, error: commitError } = await supabase.rpc('commit_checkout', {
    p_idempotency_key: payload.idempotencyKey,
    p_request_hash: requestHash,
    p_user_id: context.userId || null,
    p_guest_email: guestEmail,
    p_guest_upload_session_hash: context.userId ? null : context.guestUploadSessionHash || null,
    p_order: toJson({
      guest_name: customerName,
      guest_phone: customerPhone,
      delivery_type: payload.deliveryType,
      delivery_address_snapshot: deliveryAddressSnapshot ? JSON.parse(deliveryAddressSnapshot) : null,
      delivery_fee_cents: deliveryFeeCents,
      subtotal_cents: subtotalCents,
      total_cents: totalCents,
      payment_method: payload.paymentMethod,
      pix_key_used: pixKeyUsed,
      notes: payload.notes?.trim() || null,
    }),
    p_items: toJson(processedItems.map((item) => ({
      service_id: item.service_id,
      product_id: item.product_id,
      service_name_snapshot: item.service_name_snapshot,
      service_description_snapshot: item.service_description_snapshot,
      product_name_snapshot: item.product_name_snapshot,
      fields_snapshot: item.fields_snapshot,
      quantity: item.quantity,
      pages_count: item.pages_count,
      pages_method: item.pages_method,
      is_double_sided: item.is_double_sided,
      unit_price_cents: item.unit_price_cents,
      total_price_cents: item.total_price_cents,
      pricing_rule_id: item.pricing_rule_id,
      pricing_rule_snapshot: item.pricing_rule_snapshot,
      discount_cents: item.discount_cents,
      file_ids: item.file_ids,
    }))),
    p_file_ids: uniqueFileIds,
  });
  if (commitError) {
    if (commitError.message.includes('IDEMPOTENCY_CONFLICT')) throw new Error('IDEMPOTENCY_CONFLICT');
    throw new Error(`TRANSACTION_ERROR: ${commitError.message}`);
  }
  const committed = committedRows?.[0];
  if (!committed) throw new Error('TRANSACTION_ERROR: CHECKOUT_COMMIT_EMPTY');

  const whatsappOrder: WhatsAppOrderInput = {
    orderNumber: committed.order_number,
    customerName,
    customerPhone,
    deliveryType: payload.deliveryType,
    paymentMethod: payload.paymentMethod,
    subtotal,
    deliveryFee,
    total,
    hasEstimates: filesForWhatsApp.some((file) => file.page_count_method !== 'exact'),
  };
  const message = buildWhatsAppMessage(whatsappOrder, itemsForWhatsApp);
  const whatsappUrl = buildWhatsAppUrl(message, config.whatsapp_number || '');

  return {
    orderId: committed.order_id,
    orderNumber: committed.order_number,
    orderCode: committed.order_code,
    total: major(committed.total_cents),
    hasEstimates: filesForWhatsApp.some((file) => file.page_count_method !== 'exact'),
    paymentMethod: committed.payment_method as PaymentMethod,
    whatsappUrl,
  };
}
