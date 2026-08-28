import { useState, useRef, useCallback } from 'react';
import type { PdfDimensionReview, PricingCalculationInput, PricingCalculationResult } from '@/types/pricing';

export function usePricingPreview() {
  const [result, setResult] = useState<PricingCalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dimensionReview, setDimensionReview] = useState<PdfDimensionReview | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPreview = useCallback(async (input: PricingCalculationInput) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    setDimensionReview(null);
    
    try {
      const response = await fetch('/api/pricing/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const nextError = new Error(data.error?.message || data.error || 'Failed to calculate price') as Error & {
          dimensionReview?: PdfDimensionReview;
        };
        nextError.dimensionReview = data.error?.dimensionReview ?? null;
        throw nextError;
      }

      setResult(data.data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
      setDimensionReview(err instanceof Error && 'dimensionReview' in err
        ? (err as Error & { dimensionReview?: PdfDimensionReview }).dimensionReview ?? null
        : null);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetchPreview, result, isLoading, error, dimensionReview };
}
