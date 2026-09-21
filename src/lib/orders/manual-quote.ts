import { createHash } from 'node:crypto';
import { z } from 'zod';
import { digitsOnly } from '@/lib/forms/brazil';

const optionalTrimmed = (maximum: number) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().max(maximum).optional(),
);

const deliveryAddressSchema = z.object({
  street: z.string().trim().min(1).max(255),
  number: z.string().trim().min(1).max(50),
  complement: optionalTrimmed(100),
  neighborhood: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  zipCode: z.preprocess(
    (value) => typeof value === 'string' ? digitsOnly(value) : value,
    z.string().length(8),
  ),
}).strict();

export const adminQuoteCommandSchema = z.object({
  operation: z.enum(['issue', 'revise']),
  expectedQuoteVersion: z.number().int().min(0),
  idempotencyKey: z.string().uuid(),
  commercialObservation: z.string().trim().min(3).max(4000),
  changeReason: optionalTrimmed(2000),
  expiresAt: z.string().datetime({ offset: true }),
  deliveryFeeCents: z.number().int().min(0).max(10_000_000),
  items: z.array(z.object({
    orderItemId: z.string().uuid(),
    unitPriceCents: z.number().int().min(0).max(100_000_000),
  }).strict()).min(1).max(1000),
}).strict().superRefine((value, context) => {
  if (value.operation === 'issue' && value.expectedQuoteVersion !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expectedQuoteVersion'], message: 'A primeira proposta deve partir da versão zero.' });
  }
  if (value.operation === 'issue' && value.changeReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['changeReason'], message: 'A primeira proposta não possui motivo de revisão.' });
  }
  if (value.operation === 'revise' && (!value.changeReason || value.changeReason.length < 3)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['changeReason'], message: 'Explique o motivo da revisão.' });
  }
  if (new Date(value.expiresAt).getTime() <= Date.now()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'A validade precisa estar no futuro.' });
  }
  if (new Set(value.items.map((item) => item.orderItemId)).size !== value.items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Um item não pode aparecer duas vezes.' });
  }
});

export type AdminQuoteCommand = z.infer<typeof adminQuoteCommandSchema>;

export const customerQuoteActionSchema = z.object({
  action: z.enum(['accept', 'decline']),
  quoteId: z.string().uuid(),
  expectedQuoteVersion: z.number().int().min(1),
  idempotencyKey: z.string().uuid(),
  requestCode: z.string().uuid().optional(),
  note: optionalTrimmed(2000),
  paymentMethod: z.enum(['pix', 'card', 'cash']).optional(),
  deliveryType: z.enum(['pickup', 'delivery']).optional(),
  deliveryAddress: deliveryAddressSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.action === 'decline') {
    if (!value.note || value.note.length < 3) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Informe o motivo da recusa.' });
    }
    return;
  }
  if (!value.paymentMethod) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentMethod'], message: 'Escolha a forma de pagamento.' });
  }
  if (!value.deliveryType) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryType'], message: 'Escolha retirada ou entrega.' });
  }
  if (value.deliveryType === 'delivery' && !value.deliveryAddress) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryAddress'], message: 'Informe o endereço de entrega.' });
  }
  if (value.deliveryType === 'pickup' && value.deliveryAddress) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryAddress'], message: 'Retirada não deve enviar endereço.' });
  }
});

export type CustomerQuoteAction = z.infer<typeof customerQuoteActionSchema>;

export function quoteCommandHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function formatQuoteCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function buildQuoteWhatsAppMessage(input: {
  orderNumber: string;
  version: number;
  totalCents: number;
  expiresAt: string;
  commercialObservation: string;
  customerActionUrl: string;
}): string {
  const expiry = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(input.expiresAt));
  return [
    'JK Copycenter — orçamento disponível',
    `Protocolo #${input.orderNumber}`,
    `Proposta v${input.version}: ${formatQuoteCurrency(input.totalCents)}`,
    `Validade: ${expiry}`,
    input.commercialObservation.trim(),
    '',
    'Revise os itens e registre seu aceite ou recusa no link seguro:',
    input.customerActionUrl,
  ].join('\n');
}
