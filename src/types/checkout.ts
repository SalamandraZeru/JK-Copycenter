import type { DeliveryType, PaymentMethod } from './index';
import type { PricingDimensions } from './pricing';

export interface AddressInput {
  street: string;
  number: string;
  complement?: string | undefined;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface CheckoutFieldValue {
  fieldKey: string;
  value: string | number | boolean;
  label?: string;
  /**
   * Presentation metadata captured with the cart intent. The checkout API
   * ignores it and resolves the actual option again on the server.
   */
  selectedOption?: {
    value: string;
    label: string;
  };
}

export interface CheckoutItem {
  serviceId?: string | undefined;
  productId?: string | undefined;
  attributeIds: string[];
  fieldValues: CheckoutFieldValue[];
  pageCount: number;
  isFrontAndBack: boolean;
  quantity: number;
  fileIds: string[];
  bindingFileIds?: string[];
  dimensions?: PricingDimensions;
  bookletPaddingApproved?: boolean;
  artworkBleedAcknowledged?: boolean;
}

export interface CheckoutPayload {
  idempotencyKey: string;
  items: CheckoutItem[];
  deliveryType: DeliveryType;
  deliveryAddressId?: string | undefined;    // cliente logado
  deliveryAddress?: AddressInput | undefined; // guest
  customerName?: string | undefined;          // guest
  customerPhone?: string | undefined;         // guest
  guestEmail?: string | undefined;            // guest
  paymentMethod: PaymentMethod;
  notes?: string | undefined;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  orderCode: string;
  total: number;
  hasEstimates: boolean;
  paymentMethod: PaymentMethod;
  whatsappUrl: string;   // deep link wa.me pré-preenchido
}

/** Server-authoritative quote shown immediately before order creation. */
export interface CheckoutQuoteItem {
  name: string;
  description: string | null;
  quantity: number;
  pageCount: number;
  pageCountMethod: 'exact' | 'estimated' | 'manual';
  unitPriceCents: number;
  totalPriceCents: number;
  discountCents: number;
}

export interface CheckoutQuote {
  items: CheckoutQuoteItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  hasEstimates: boolean;
}

export interface CheckoutResponseSuccess {
  success: true;
  data: CheckoutResult;
}

export interface CheckoutResponseError {
  success: false;
  error: string;
}

export type CheckoutResponse = CheckoutResponseSuccess | CheckoutResponseError;

export interface Order {
  id: string;
  userId: string | null;
  orderNumber: string;
  orderToken: string;
  idempotencyKey: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  deliveryAddress?: AddressInput | Record<string, unknown> | null;
  deliveryAddressSnapshot?: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItemFileInfo {
  id: string;
  originalName: string;
  pageCountMethod: string;
  orderId?: string | null;
  orderItemId?: string | null;
  userId?: string | null;
  mimeType?: string;
  fileType?: string;
  sizeBytes?: number;
  pageCount?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItemWithFiles {
  id: string;
  orderId: string;
  serviceId?: string | null;
  productId?: string | null;
  serviceNameSnapshot?: string | null;
  serviceDescriptionSnapshot?: string | null;
  productNameSnapshot?: string | null;
  quantity: number;
  pageCount: number;
  basePrice: number;
  totalPrice: number;
  discountApplied?: number | null;
  fieldsSnapshot?: Record<string, unknown> | unknown[];
  pricingRuleSnapshot?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  files: OrderItemFileInfo[];
}
