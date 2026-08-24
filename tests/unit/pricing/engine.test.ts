import { describe, expect, it } from 'vitest';
import { calculatePrice } from '@/lib/pricing/engine';
import { baseInput, pricingContext } from '../../helpers/pricing-context';

describe('motor de preço em centavos', () => {
  it('seleciona a regra mais específica e calcula apenas com inteiros', () => {
    const result = calculatePrice(baseInput, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ruleId).toBe('rule-exact');
      expect(result.data.pricePerPageCents).toBe(50);
      expect(result.data.unitPriceCents).toBe(100);
      expect(result.data.totalCents).toBe(100);
      expect(Number.isInteger(result.data.totalCents)).toBe(true);
    }
  });

  it('usa coringa somente quando a regra exata não atende', () => {
    const result = calculatePrice({ ...baseInput, attributeIds: ['paper-a4', 'color-full'] }, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ruleId).toBe('rule-wildcard');
  });

  it('seleciona a regra pelo valor de um campo real do serviço', () => {
    const context = pricingContext();
    context.rules = [
      {
        id: 'rule-finish-none',
        serviceId: 'service-1',
        name: 'Sem acabamento',
        pricePerPageCents: 35,
        version: 1,
        isActive: true,
        attributes: [],
        fieldConditions: [{ fieldId: 'field-finish', expectedValue: 'none' }],
      },
      {
        id: 'rule-finish-staple',
        serviceId: 'service-1',
        name: 'Com grampo',
        pricePerPageCents: 70,
        version: 1,
        isActive: true,
        attributes: [],
        fieldConditions: [{ fieldId: 'field-finish', expectedValue: 'staple' }],
      },
    ];
    const result = calculatePrice({ ...baseInput, fieldValues: [{ fieldKey: 'finish', value: 'staple' }] }, context);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ruleId).toBe('rule-finish-staple');
      expect(result.data.pricePerPageCents).toBe(70);
    }
  });

  it('prioriza condição específica de campo em relação ao coringa', () => {
    const context = pricingContext();
    context.rules = [
      {
        id: 'rule-finish-any',
        serviceId: 'service-1',
        name: 'Qualquer acabamento',
        pricePerPageCents: 30,
        version: 1,
        isActive: true,
        attributes: [],
        fieldConditions: [{ fieldId: 'field-finish', expectedValue: null }],
      },
      {
        id: 'rule-finish-premium',
        serviceId: 'service-1',
        name: 'Premium',
        pricePerPageCents: 60,
        version: 1,
        isActive: true,
        attributes: [],
        fieldConditions: [{ fieldId: 'field-finish', expectedValue: 'premium' }],
      },
    ];
    const result = calculatePrice({ ...baseInput, fieldValues: [{ fieldKey: 'finish', value: 'premium' }] }, context);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ruleId).toBe('rule-finish-premium');
  });

  it('retorna QUOTE_UNAVAILABLE quando duas regras vencedoras empatam', () => {
    const context = pricingContext();
    context.rules.push({ ...context.rules[0]!, id: 'rule-duplicate' });
    const result = calculatePrice(baseInput, context);
    expect(result).toEqual({
      success: false,
      error: { code: 'QUOTE_UNAVAILABLE', message: 'Regra de preço ausente ou ambígua.' },
    });
  });

  it('bloqueia quando não há regra e fallback não foi autorizado', () => {
    const result = calculatePrice({ ...baseInput, attributeIds: ['paper-a3', 'color-full'] }, pricingContext());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('QUOTE_UNAVAILABLE');
  });

  it('usa preço-base apenas quando o serviço autoriza explicitamente', () => {
    const context = pricingContext();
    context.service.fallbackBehavior = 'use_base';
    const result = calculatePrice({ ...baseInput, attributeIds: ['paper-a3', 'color-full'] }, context);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usedFallback).toBe(true);
      expect(result.data.pricePerPageCents).toBe(30);
    }
  });

  it('resolve preço adicional da opção carregada no servidor', () => {
    const input = { ...baseInput, fieldValues: [{ fieldKey: 'finish', value: 'staple' }] };
    const result = calculatePrice(input, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalCents).toBe(150);
  });

  it('resolve multiplicador da opção carregada no servidor', () => {
    const input = { ...baseInput, fieldValues: [{ fieldKey: 'finish', value: 'premium' }] };
    const result = calculatePrice(input, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalCents).toBe(150);
  });

  it('rejeita opção inativa e campo obrigatório ausente', () => {
    const inactive = calculatePrice({
      ...baseInput,
      fieldValues: [{ fieldKey: 'finish', value: 'retired' }],
    }, pricingContext());
    const missing = calculatePrice({ ...baseInput, fieldValues: [] }, pricingContext());
    expect(inactive.success).toBe(false);
    expect(missing.success).toBe(false);
  });

  it('aplica frente e verso e arredondamento configurados', () => {
    const result = calculatePrice({ ...baseInput, pageCount: 1, isFrontAndBack: true }, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalCents).toBe(90);
  });

  it('aplica uma única faixa progressiva em basis points', () => {
    const result = calculatePrice({ ...baseInput, pageCount: 1, quantity: 10 }, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subtotalBeforeDiscountCents).toBe(500);
      expect(result.data.discountBps).toBe(500);
      expect(result.data.discountCents).toBe(25);
      expect(result.data.totalCents).toBe(475);
    }
  });

  it('rejeita faixas de desconto sobrepostas', () => {
    const context = pricingContext();
    context.discounts.push({ id: 'overlap', minQuantity: 5, maxQuantity: 20, discountBps: 100 });
    const result = calculatePrice({ ...baseInput, quantity: 10 }, context);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('QUOTE_UNAVAILABLE');
  });

  it('preserva snapshots reproduzíveis da versão, regra, campos e atributos', () => {
    const result = calculatePrice(baseInput, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.serviceSnapshot.pricingVersion).toBe(7);
      expect(result.data.ruleVersion).toBe(3);
      expect(result.data.fieldsSnapshot[0]?.valueLabel).toBe('Sem acabamento');
      expect(result.data.attributeIdsSnapshot).toEqual(['paper-a4', 'color-bw']);
    }
  });

  it('alterar o catálogo hoje não modifica uma cotação já materializada', () => {
    const context = pricingContext();
    const oldQuote = calculatePrice(baseInput, context);
    context.rules[0]!.pricePerPageCents = 90;
    context.service.pricingVersion = 8;
    const newQuote = calculatePrice(baseInput, context);
    expect(oldQuote.success && oldQuote.data.totalCents).toBe(100);
    expect(newQuote.success && newQuote.data.totalCents).toBe(180);
    expect(oldQuote.success && oldQuote.data.serviceSnapshot.pricingVersion).toBe(7);
  });
});
