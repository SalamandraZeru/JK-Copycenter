/**
 * Global Type Exports
 *
 * Central barrel file for all application types.
 * Import from '@/types' instead of individual files.
 *
 * Shared TypeScript types for the application.
 */

// ---------------------------------------------------------------------------
// Re-export database helpers
// ---------------------------------------------------------------------------

export type { Tables, TablesInsert, TablesUpdate, Enums } from './database';
export type { Database, Json } from './supabase';

// ---------------------------------------------------------------------------
// Re-export pricing types
// ---------------------------------------------------------------------------

export type {
  FallbackBehavior,
  PricingRoundingMode,
  PricingProfile,
  PricingProfileConfig,
  PricingDimensions,
  PricingRuleAttribute,
  PricingRuleFieldCondition,
  PricingRule,
  PricingDiscount,
  BindingPriceTier,
  BindingFileSelection,
  BindingSelectionSnapshot,
  ServerFieldPriceEffect,
  ServerPricingOption,
  ServerPricingField,
  PricingAttribute,
  PricingContext,
  PricingFieldSelection,
  PricingCalculationInput,
  PricingFieldSnapshot,
  PricingCalculationResult,
  PricingErrorCode,
  PricingError,
  PricingResult,
} from './pricing';

// ---------------------------------------------------------------------------
// Re-export checkout types
// ---------------------------------------------------------------------------

export type {
  AddressInput,
  CheckoutFieldValue,
  CheckoutItem,
  CheckoutPayload,
  CheckoutResult,
  CheckoutQuote,
  CheckoutQuoteItem,
  CheckoutResponseSuccess,
  CheckoutResponseError,
  CheckoutResponse,
  Order,
  OrderItemFileInfo as CheckoutOrderItemFileInfo,
  OrderItemWithFiles,
} from './checkout';

// ---------------------------------------------------------------------------
// Enum value aliases (for convenience in business logic)
// ---------------------------------------------------------------------------

import type { Enums } from './database';

export type OrderStatus = Enums<'order_status'>;
export type DeliveryType = Enums<'delivery_type'>;
export type AdminRole = Enums<'admin_role'>;
export type FileStatus = Enums<'file_status'>;
export type FileType = Enums<'file_type'>;
export type PageCountMethod = Enums<'page_count_method'>;
export type PaymentMethod = Enums<'payment_method'>;
export type PaymentStatus = Enums<'payment_status'>;
export type FieldType = Enums<'field_type'>;
export type CartItemType = Enums<'cart_item_type'>;

// ---------------------------------------------------------------------------
// Service field structures
// ---------------------------------------------------------------------------

export interface ServiceFieldPriceEffect {
  readonly type: 'fixed' | 'multiply' | 'per_page' | 'none';
  readonly value: number;
}

export interface ServiceFieldOption {
  readonly value: string;
  readonly label: string;
  readonly price_effect: ServiceFieldPriceEffect | null;
}

export interface ServiceField {
  readonly id: string;
  readonly service_id: string;
  readonly key: string;
  readonly label: string;
  readonly field_type: FieldType;
  readonly options: readonly ServiceFieldOption[];
  readonly is_required: boolean;
  readonly sort_order: number;
  readonly is_active: boolean;
}

// ---------------------------------------------------------------------------
// Composite query types
// ---------------------------------------------------------------------------

export interface OrderWithItems {
  readonly id: string;
  readonly order_number: string;
  readonly status: OrderStatus;
  readonly payment_status: PaymentStatus;
  readonly payment_method: PaymentMethod;
  readonly delivery_type: DeliveryType;
  readonly subtotal: number;
  readonly delivery_fee: number;
  readonly total: number;
  readonly created_at: string;
  readonly items: readonly OrderItemSnapshot[];
}

export interface OrderItemSnapshot {
  readonly id: string;
  readonly service_name_snapshot: string | null;
  readonly product_name_snapshot: string | null;
  readonly fields_snapshot: Record<string, unknown>;
  readonly quantity: number;
  readonly pages_count: number;
  readonly pages_method: PageCountMethod;
  readonly is_double_sided: boolean;
  readonly unit_price: number;
  readonly total_price: number;
  readonly discount_applied: number | null;
  readonly files: readonly OrderFileInfo[];
}

export interface OrderFileInfo {
  readonly id: string;
  readonly original_name: string;
  readonly file_type: FileType;
  readonly size_bytes: number;
  readonly page_count: number;
  readonly page_count_method: PageCountMethod;
  readonly status: FileStatus;
}

// ---------------------------------------------------------------------------
// User types
// ---------------------------------------------------------------------------

export interface UserProfile {
  readonly id: string;
  readonly full_name: string | null;
  readonly phone: string | null;
  readonly avatar_url: string | null;
  readonly email: string;
}

export interface AdminUser {
  readonly id: string;
  readonly full_name: string;
  readonly role: AdminRole;
  readonly is_active: boolean;
  readonly email: string;
}

// ---------------------------------------------------------------------------
// Cart types
// ---------------------------------------------------------------------------

export interface CartItem {
  readonly id: string;
  readonly item_type: CartItemType;
  readonly reference_id: string;
  readonly selected_options: Readonly<Record<string, string | number | boolean>>;
  readonly file_ids: readonly string[];
  readonly quantity: number;
  readonly is_double_sided: boolean;
  readonly notes: string | null;
}

export interface CartState {
  readonly items: readonly CartItem[];
  readonly count: number;
}

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

export interface ApiResponseSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly error: null;
}

export interface ApiResponseError {
  readonly success: false;
  readonly data: null;
  readonly error: string;
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

// ---------------------------------------------------------------------------
// Upload types
// ---------------------------------------------------------------------------

export interface UploadResult {
  readonly file_id: string;
  readonly original_name: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly page_count: number;
  readonly count_method: PageCountMethod;
}

export interface FileValidationResult {
  readonly valid: boolean;
  readonly error: string | null;
  readonly detected_type: FileType | null;
  readonly size_bytes: number;
}
