import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { PricingCalculationInput, PricingResult } from '@/types/pricing';
import { calculatePrice } from './engine';
import { loadPricingData, QuoteUnavailableError } from './loader';

export async function validateAndRecalculate(
  input: PricingCalculationInput,
  supabase: SupabaseClient<Database>
): Promise<PricingResult> {
  try {
    const context = await loadPricingData(supabase, input.serviceId);
    return calculatePrice(input, context);
  } catch (caught: unknown) {
    return {
      success: false,
      error: {
        code: caught instanceof QuoteUnavailableError ? 'QUOTE_UNAVAILABLE' : 'INVALID_INPUT',
        message: caught instanceof Error ? caught.message : 'Cotação indisponível.',
      },
    };
  }
}
