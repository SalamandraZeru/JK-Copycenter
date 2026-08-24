import type { PricingCalculationInput, PricingContext } from '@/types/pricing';

export const baseInput: PricingCalculationInput = {
  serviceId: 'service-1',
  attributeIds: ['paper-a4', 'color-bw'],
  fieldValues: [{ fieldKey: 'finish', value: 'none' }],
  pageCount: 2,
  isFrontAndBack: false,
  quantity: 1,
  fileIds: [],
};

export function pricingContext(overrides: Partial<PricingContext> = {}): PricingContext {
  const base: PricingContext = {
    service: {
      id: 'service-1',
      name: 'Impressão',
      description: 'Impressão configurável',
      basePriceCents: 30,
      fallbackBehavior: 'block',
      pricingVersion: 7,
    },
    attributes: [
      { id: 'paper-a4', groupId: 'paper', isActive: true },
      { id: 'paper-a3', groupId: 'paper', isActive: true },
      { id: 'color-bw', groupId: 'color', isActive: true },
      { id: 'color-full', groupId: 'color', isActive: true },
    ],
    fields: [
      {
        id: 'field-finish',
        key: 'finish',
        label: 'Acabamento',
        fieldType: 'select',
        isRequired: true,
        isActive: true,
        options: [
          { value: 'none', label: 'Sem acabamento', isActive: true, priceEffect: { type: 'none' } },
          { value: 'staple', label: 'Grampo', isActive: true, priceEffect: { type: 'fixed', valueCents: 25 } },
          { value: 'premium', label: 'Premium', isActive: true, priceEffect: { type: 'multiply', multiplierBps: 15_000 } },
          { value: 'retired', label: 'Inativa', isActive: false, priceEffect: { type: 'fixed', valueCents: 1 } },
        ],
      },
    ],
    rules: [
      {
        id: 'rule-exact',
        serviceId: 'service-1',
        name: 'A4 P&B',
        pricePerPageCents: 50,
        version: 3,
        isActive: true,
        attributes: [
          { attributeId: 'paper-a4', groupId: 'paper' },
          { attributeId: 'color-bw', groupId: 'color' },
        ],
        fieldConditions: [],
      },
      {
        id: 'rule-wildcard',
        serviceId: 'service-1',
        name: 'A4 qualquer cor',
        pricePerPageCents: 40,
        version: 2,
        isActive: true,
        attributes: [
          { attributeId: 'paper-a4', groupId: 'paper' },
          { attributeId: null, groupId: 'color' },
        ],
        fieldConditions: [],
      },
    ],
    discounts: [
      { id: 'discount-10', minQuantity: 10, maxQuantity: 49, discountBps: 500 },
      { id: 'discount-50', minQuantity: 50, maxQuantity: null, discountBps: 1_000 },
    ],
    doubleSidedMultiplierBps: 18_000,
    roundingMode: 'half_up',
  };
  return { ...base, ...overrides };
}
