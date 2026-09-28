import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/supabase';
import type { GraphicQuoteRequestIntent } from './graphic-quote-request-intent';
import { loadAuthorizedReadyFiles, type AuthorizedCheckoutFile } from '@/lib/upload/access';
import { loadSystemConfig } from './config';
import { buildWhatsAppUrl } from './whatsapp';
import {
  isFieldOptionSelectionAllowed,
  resolveFieldOptionAvailability,
  type FieldOptionDependency,
} from '@/lib/services/field-option-dependencies';
import { isPricingProfile, normalizePricingProfileConfig } from '@/lib/pricing/profiles';
import type { GraphicQuoteTechnicalRequirements } from '@/types/service';
import {
  graphicQuoteTechnicalRequirements,
  validateGraphicQuoteTechnicalInput,
} from './graphic-quote-technical';

interface QuoteRequestContext {
  userId?: string;
  guestEmail?: string;
  guestUploadSessionHash?: string;
}

interface QuoteFieldOption {
  value: string;
  label: string;
  isActive: boolean;
}

interface QuoteField {
  id: string;
  key: string;
  label: string;
  fieldType: Database['public']['Enums']['field_type'];
  isRequired: boolean;
  options: QuoteFieldOption[];
}

interface QuoteServiceDefinition {
  id: string;
  name: string;
  description: string | null;
  catalogVersion: number;
  requireCompleteCompatibility: boolean;
  technicalRequirements: GraphicQuoteTechnicalRequirements;
  fields: QuoteField[];
  dependencies: FieldOptionDependency[];
}

interface PreparedQuoteItem {
  serviceId: string;
  serviceName: string;
  quantity: number;
  fileCount: number;
  fieldSummary: string[];
  databasePayload: {
    service_id: string;
    catalog_version: number;
    quantity: number;
    fields_snapshot: Json;
    file_ids: string[];
  };
}

type QuoteMessageItem = Pick<PreparedQuoteItem, 'serviceName' | 'quantity' | 'fileCount' | 'fieldSummary'>;

export interface GraphicQuoteRequestResult {
  requestId: string;
  protocol: string;
  requestCode: string;
  quoteStatus: Exclude<Database['public']['Enums']['order_quote_status'], 'not_applicable'>;
  whatsappUrl: string | null;
  whatsappMessage: string;
  replayed: boolean;
}

function asRecord(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function publicOptions(value: Json): QuoteFieldOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const option = asRecord(raw);
    if (!option || typeof option.value !== 'string' || typeof option.label !== 'string') return [];
    return [{ value: option.value, label: option.label, isActive: option.is_active !== false }];
  });
}

function dependencyConditions(value: Json, fallbackFieldId: string, fallbackValue: string) {
  if (!Array.isArray(value)) return [{ fieldId: fallbackFieldId, optionValue: fallbackValue }];
  return value.flatMap((condition) => {
    const record = asRecord(condition);
    return record && typeof record.field_id === 'string' && typeof record.option_value === 'string'
      ? [{ fieldId: record.field_id, optionValue: record.option_value }]
      : [];
  });
}

async function loadServiceDefinition(
  supabase: SupabaseClient<Database>,
  serviceId: string,
): Promise<QuoteServiceDefinition> {
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('id, name, description, catalog_version, commercial_mode, pricing_profile, pricing_profile_config')
    .eq('id', serviceId)
    .eq('is_active', true)
    .eq('catalog_state', 'published')
    .is('deleted_at', null)
    .maybeSingle();
  if (serviceError || !service || service.commercial_mode !== 'manual_quote'
      || !isPricingProfile(service.pricing_profile)) {
    throw new Error('SERVICE_UNAVAILABLE');
  }

  const [fieldsResult, dependenciesResult] = await Promise.all([
    supabase
      .from('service_fields')
      .select('id, key, label, field_type, options, is_required, is_active')
      .eq('service_id', service.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('service_field_option_dependencies')
      .select('source_field_id, source_option_value, source_conditions, target_field_id, target_option_value')
      .eq('service_id', service.id),
  ]);
  if (fieldsResult.error || dependenciesResult.error) throw new Error('SERVICE_CONFIGURATION_UNAVAILABLE');

  const profileConfig = normalizePricingProfileConfig(service.pricing_profile_config);
  const technicalRequirements = graphicQuoteTechnicalRequirements(service.pricing_profile, profileConfig);
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    catalogVersion: service.catalog_version,
    requireCompleteCompatibility: profileConfig.requireCompleteCompatibility === true,
    technicalRequirements,
    fields: (fieldsResult.data ?? []).filter((field) => field.is_active).map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      fieldType: field.field_type,
      isRequired: field.is_required,
      options: publicOptions(field.options),
    })),
    dependencies: (dependenciesResult.data ?? []).map((dependency) => ({
      sourceFieldId: dependency.source_field_id,
      sourceOptionValue: dependency.source_option_value,
      sourceConditions: dependencyConditions(
        dependency.source_conditions,
        dependency.source_field_id,
        dependency.source_option_value,
      ),
      targetFieldId: dependency.target_field_id,
      targetOptionValue: dependency.target_option_value,
    })),
  };
}

function fieldValueLabel(value: string | number | boolean): string {
  return typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value);
}

function prepareItem(
  intent: GraphicQuoteRequestIntent['items'][number],
  service: QuoteServiceDefinition,
  filesById: ReadonlyMap<string, AuthorizedCheckoutFile>,
): PreparedQuoteItem {
  const selections = new Map<string, string | number | boolean>();
  for (const selection of intent.fieldValues) {
    if (selections.has(selection.fieldKey)) throw new Error('SERVICE_FIELD_DUPLICATED');
    selections.set(selection.fieldKey, selection.value);
  }
  if ([...selections.keys()].some((key) => !service.fields.some((field) => field.key === key))) {
    throw new Error('SERVICE_FIELD_INVALID');
  }

  const selectedByFieldId = new Map<string, string | number | boolean>();
  const fieldSnapshots: Array<{
    fieldKey: string;
    fieldLabel: string;
    value: string | number | boolean;
    valueLabel: string;
  }> = [];
  const missingRequired: QuoteField[] = [];

  for (const field of service.fields) {
    const value = selections.get(field.key);
    const missing = value === undefined || value === ''
      || (field.fieldType === 'checkbox' && field.isRequired && value === false);
    if (missing) {
      if (field.isRequired) missingRequired.push(field);
      continue;
    }

    let valueLabel = fieldValueLabel(value);
    if (field.fieldType === 'select' || field.fieldType === 'radio') {
      const option = field.options.find((candidate) => candidate.isActive && candidate.value === String(value));
      if (!option) throw new Error('SERVICE_FIELD_INVALID');
      valueLabel = option.label;
    } else if (field.fieldType === 'checkbox' && typeof value !== 'boolean') {
      throw new Error('SERVICE_FIELD_INVALID');
    } else if (field.fieldType === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error('SERVICE_FIELD_INVALID');
    } else if ((field.fieldType === 'text' || field.fieldType === 'textarea') && typeof value !== 'string') {
      throw new Error('SERVICE_FIELD_INVALID');
    }

    selectedByFieldId.set(field.id, value);
    fieldSnapshots.push({ fieldKey: field.key, fieldLabel: field.label, value, valueLabel });
  }

  const compatibilityOptions = {
    requireCompletePathMatch: service.requireCompleteCompatibility,
  };
  for (const field of missingRequired) {
    const availability = resolveFieldOptionAvailability(
      service.dependencies,
      selectedByFieldId,
      field.id,
      compatibilityOptions,
    );
    const unavailableCheckbox = field.fieldType === 'checkbox'
      && availability.isRestricted
      && !availability.allowedOptionValues.has('true');
    if (!unavailableCheckbox) throw new Error('SERVICE_FIELD_REQUIRED');
  }
  for (const field of service.fields) {
    if (!isFieldOptionSelectionAllowed(
      service.dependencies,
      selectedByFieldId,
      field.id,
      selectedByFieldId.get(field.id),
      compatibilityOptions,
    )) {
      throw new Error('SERVICE_FIELD_DEPENDENCY_INVALID');
    }
  }

  const itemFiles = intent.fileIds.map((fileId) => filesById.get(fileId));
  if (itemFiles.some((file) => !file)) throw new Error('FILE_ACCESS_DENIED');
  const files = itemFiles as AuthorizedCheckoutFile[];
  const pageCount = files.reduce((sum, file) => sum + Math.max(1, file.page_count), 0);
  const pageCountMethod = files.every((file) => file.page_count_method === 'exact') ? 'exact' : 'estimated';
  validateGraphicQuoteTechnicalInput(service.technicalRequirements, {
    files,
    dimensions: intent.dimensions,
    bookletPaddingApproved: intent.bookletPaddingApproved,
    artworkBleedAcknowledged: intent.artworkBleedAcknowledged,
  });
  const technical: Record<string, Json | undefined> = {
    fileCount: files.length,
    pageCount,
    pageCountMethod,
    bindingFileCount: intent.bindingFileIds.length,
    bookletPaddingApproved: intent.bookletPaddingApproved,
    artworkBleedAcknowledged: intent.artworkBleedAcknowledged,
  };
  if (Object.keys(intent.dimensions).length > 0) technical.dimensions = intent.dimensions;

  const snapshot = {
    schemaVersion: 1,
    selections: fieldSnapshots,
    technical,
  };
  return {
    serviceId: service.id,
    serviceName: service.name,
    quantity: intent.quantity,
    fileCount: files.length,
    fieldSummary: fieldSnapshots.map((field) => `${field.fieldLabel}: ${field.valueLabel}`),
    databasePayload: {
      service_id: service.id,
      catalog_version: service.catalogVersion,
      quantity: intent.quantity,
      fields_snapshot: JSON.parse(JSON.stringify(snapshot)) as Json,
      file_ids: intent.fileIds,
    },
  };
}

function requestHash(
  payload: GraphicQuoteRequestIntent,
  actor: { userId?: string; guestEmail?: string },
  customerName: string,
  customerPhone: string,
): string {
  const canonical = {
    actor: actor.userId ? { userId: actor.userId } : { guestEmail: actor.guestEmail },
    customerName,
    customerPhone,
    notes: payload.notes?.trim() || null,
    items: payload.items.map((item) => ({
      serviceId: item.serviceId,
      quantity: item.quantity,
      fieldValues: [...item.fieldValues].sort((left, right) => left.fieldKey.localeCompare(right.fieldKey)),
      fileIds: [...item.fileIds].sort(),
      bindingFileIds: [...item.bindingFileIds].sort(),
      dimensions: item.dimensions,
      bookletPaddingApproved: item.bookletPaddingApproved,
      artworkBleedAcknowledged: item.artworkBleedAcknowledged,
    })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function actorHash(context: { userId?: string; guestEmail?: string }): string {
  const actor = context.userId ? `user:${context.userId}` : `guest:${context.guestEmail || ''}`;
  return crypto.createHash('sha256').update(actor).digest('hex');
}

function messageItemFromSnapshot(item: {
  service_name_snapshot: string | null;
  quantity: number;
  fields_snapshot: Json;
}): QuoteMessageItem {
  const snapshot = asRecord(item.fields_snapshot);
  const technical = asRecord(snapshot?.technical);
  const selections = Array.isArray(snapshot?.selections) ? snapshot.selections : [];
  const fieldSummary = selections.flatMap((selection) => {
    const record = asRecord(selection);
    return record && typeof record.fieldLabel === 'string' && typeof record.valueLabel === 'string'
      ? [`${record.fieldLabel}: ${record.valueLabel}`]
      : [];
  });
  return {
    serviceName: item.service_name_snapshot || 'Serviço gráfico',
    quantity: item.quantity,
    fileCount: typeof technical?.fileCount === 'number' ? technical.fileCount : 0,
    fieldSummary,
  };
}

function whatsappMessage(protocol: string, items: readonly QuoteMessageItem[]): string {
  const summary = items.map((item) => {
    const configuration = item.fieldSummary.length > 0 ? ` · ${item.fieldSummary.join(' · ')}` : '';
    return `- ${item.serviceName} · quantidade ${item.quantity} · ${item.fileCount} arquivo(s)${configuration}`;
  }).join('\n');
  return [
    '*SOLICITAÇÃO DE ORÇAMENTO — JK COPYCENTER*',
    `Protocolo: #${protocol}`,
    '',
    summary,
    '',
    'Os arquivos foram enviados pelo site e estão disponíveis somente no painel seguro da equipe.',
    'Aguardo a análise e o valor do orçamento.',
  ].join('\n');
}

async function quoteCommunication(
  supabase: SupabaseClient<Database>,
  protocol: string,
  items: readonly QuoteMessageItem[],
): Promise<{ whatsappMessage: string; whatsappUrl: string | null }> {
  const message = whatsappMessage(protocol, items);
  try {
    const config = await loadSystemConfig(supabase, ['whatsapp_number']);
    return {
      whatsappMessage: message,
      whatsappUrl: buildWhatsAppUrl(message, config.whatsapp_number || ''),
    };
  } catch {
    // O pedido ja existe neste ponto. Uma configuracao de contato ausente nao
    // pode transformar um commit valido em erro nem induzir um segundo envio.
    return { whatsappMessage: message, whatsappUrl: null };
  }
}

async function replayExistingRequest(
  supabase: SupabaseClient<Database>,
  context: { userId?: string; guestEmail?: string },
  idempotencyKey: string,
  hash: string,
): Promise<GraphicQuoteRequestResult | null> {
  const { data: existing, error } = await supabase
    .from('orders')
    .select('id, order_number, order_token, order_kind, quote_status, checkout_request_hash')
    .eq('checkout_actor_hash', actorHash(context))
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (error) throw new Error('QUOTE_REQUEST_REPLAY_UNAVAILABLE');
  if (!existing) return null;
  if (existing.order_kind !== 'graphic_quote' || existing.checkout_request_hash !== hash) {
    throw new Error('IDEMPOTENCY_CONFLICT');
  }

  const { data: persistedItems, error: itemsError } = await supabase
    .from('order_items')
    .select('service_name_snapshot, quantity, fields_snapshot')
    .eq('order_id', existing.id)
    .order('created_at', { ascending: true });
  if (itemsError || !persistedItems) throw new Error('QUOTE_REQUEST_REPLAY_UNAVAILABLE');
  const communication = await quoteCommunication(
    supabase,
    existing.order_number,
    persistedItems.map(messageItemFromSnapshot),
  );
  return {
    requestId: existing.id,
    protocol: existing.order_number,
    requestCode: existing.order_token,
    quoteStatus: existing.quote_status as Exclude<
      Database['public']['Enums']['order_quote_status'],
      'not_applicable'
    >,
    ...communication,
    replayed: true,
  };
}

export async function processGraphicQuoteRequest(
  payload: GraphicQuoteRequestIntent,
  context: QuoteRequestContext,
  supabase: SupabaseClient<Database>,
): Promise<GraphicQuoteRequestResult> {
  const guestEmail = context.userId
    ? undefined
    : context.guestEmail?.trim().toLowerCase() || payload.guestEmail?.trim().toLowerCase();
  if (!context.userId && !guestEmail) throw new Error('GUEST_EMAIL_REQUIRED');

  let customerName = payload.customerName?.trim() || '';
  let customerPhone = payload.customerPhone?.trim() || '';
  if (context.userId && (!customerName || !customerPhone)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', context.userId)
      .maybeSingle();
    customerName ||= profile?.full_name?.trim() || '';
    customerPhone ||= profile?.phone?.trim() || '';
  }
  if (!customerName || !customerPhone) throw new Error('CUSTOMER_CONTACT_REQUIRED');

  const hashContext = {
    ...(context.userId ? { userId: context.userId } : {}),
    ...(guestEmail ? { guestEmail } : {}),
  };
  const hash = requestHash(payload, hashContext, customerName, customerPhone);
  const replay = await replayExistingRequest(
    supabase,
    hashContext,
    payload.idempotencyKey,
    hash,
  );
  if (replay) return replay;

  const allFileIds = payload.items.flatMap((item) => item.fileIds);
  let files: AuthorizedCheckoutFile[];
  try {
    files = await loadAuthorizedReadyFiles(supabase, allFileIds, {
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.guestUploadSessionHash ? { guestUploadSessionHash: context.guestUploadSessionHash } : {}),
    });
  } catch (error) {
    const concurrentReplay = await replayExistingRequest(
      supabase,
      hashContext,
      payload.idempotencyKey,
      hash,
    );
    if (concurrentReplay) return concurrentReplay;
    throw error;
  }
  const filesById = new Map(files.map((file) => [file.id, file]));

  const preparedItems: PreparedQuoteItem[] = [];
  for (const item of payload.items) {
    const service = await loadServiceDefinition(supabase, item.serviceId);
    preparedItems.push(prepareItem(item, service, filesById));
  }

  const { data, error } = await supabase.rpc('commit_graphic_quote_request', {
    p_idempotency_key: payload.idempotencyKey,
    p_request_hash: hash,
    p_user_id: context.userId || null,
    p_guest_email: guestEmail || null,
    p_guest_upload_session_hash: context.userId ? null : context.guestUploadSessionHash || null,
    p_customer: JSON.parse(JSON.stringify({
      name: customerName,
      phone: customerPhone,
      notes: payload.notes?.trim() || null,
    })) as Json,
    p_items: JSON.parse(JSON.stringify(preparedItems.map((item) => item.databasePayload))) as Json,
    p_file_ids: allFileIds,
  });
  if (error) {
    if (error.message.includes('IDEMPOTENCY_CONFLICT')) throw new Error('IDEMPOTENCY_CONFLICT');
    if (error.message.includes('FILE_ACCESS_DENIED')) throw new Error('FILE_ACCESS_DENIED');
    if (error.message.includes('SERVICE_CATALOG_CHANGED')) throw new Error('SERVICE_CATALOG_CHANGED');
    throw new Error('QUOTE_REQUEST_COMMIT_FAILED');
  }
  const committed = data?.[0];
  if (!committed) throw new Error('QUOTE_REQUEST_COMMIT_FAILED');

  const communication = await quoteCommunication(supabase, committed.protocol, preparedItems);
  return {
    requestId: committed.request_id,
    protocol: committed.protocol,
    requestCode: committed.request_code,
    quoteStatus: committed.quote_status as Exclude<
      Database['public']['Enums']['order_quote_status'],
      'not_applicable'
    >,
    ...communication,
    replayed: committed.replayed,
  };
}
