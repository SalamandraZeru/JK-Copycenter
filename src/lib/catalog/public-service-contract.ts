import type { Database } from '@/types/supabase';
import type { PricingProfile, PricingProfileConfig } from '@/types/pricing';

type CommercialMode = Database['public']['Enums']['service_commercial_mode'];

export const PUBLIC_SERVICES_MANUAL_SELECT =
  'id, category_id, name, slug, description, image_url, commercial_mode, sort_order';
export const PUBLIC_SERVICES_LEGACY_SELECT =
  'id, category_id, name, slug, description, image_url, base_price, sort_order';

export function buildManualQuoteServiceContract<T extends object>(
  shared: T,
  commercialMode: CommercialMode,
) {
  return { ...shared, commercialMode };
}

export function buildPricedServiceContract<T extends object>(
  shared: T,
  price: {
    basePrice: number;
    pricingProfile: PricingProfile;
    pricingProfileConfig: PricingProfileConfig;
  },
) {
  return { ...shared, ...price };
}
