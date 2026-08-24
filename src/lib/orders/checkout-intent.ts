import { z } from 'zod';

const optionalTrimmedUuid = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().uuid().optional()
);

const optionalTrimmedString = (schema: z.ZodString) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  schema.optional()
);

const addressSchema = z.object({
  street: z.string().trim().min(1, 'Rua é obrigatória').max(255),
  number: z.string().trim().min(1, 'Número é obrigatório').max(50),
  complement: z.string().trim().max(100).optional(),
  neighborhood: z.string().trim().min(1, 'Bairro é obrigatório').max(100),
  city: z.string().trim().min(1, 'Cidade é obrigatória').max(100),
  state: z.string().trim().length(2, 'UF deve ter 2 caracteres'),
  zipCode: z.string().trim().min(8, 'CEP inválido').max(9),
});

const fieldValueSchema = z.object({
  fieldKey: z.string().trim().min(1).max(100),
  value: z.union([z.string().max(5_000), z.number().finite(), z.boolean()]),
});

export const checkoutIntentSchema = z.object({
  idempotencyKey: z.string().trim().uuid('Chave de idempotência inválida'),
  items: z.array(z.object({
    serviceId: optionalTrimmedUuid,
    productId: optionalTrimmedUuid,
    attributeIds: z.array(z.string().uuid()).max(100).default([]),
    fieldValues: z.array(fieldValueSchema).max(100).default([]),
    pageCount: z.number().int().min(0).default(1),
    isFrontAndBack: z.boolean().default(false),
    quantity: z.number().int().min(1, 'Quantidade mínima é 1').max(100_000_000),
    fileIds: z.array(z.string().uuid()).max(100).default([]),
  }).refine((item) => Boolean(item.serviceId || item.productId), {
    message: 'Item deve indicar serviço ou produto.',
  })).min(1, 'Carrinho não pode estar vazio').max(1_000),
  deliveryType: z.enum(['pickup', 'delivery']),
  deliveryAddressId: optionalTrimmedUuid,
  deliveryAddress: addressSchema.optional(),
  customerName: optionalTrimmedString(z.string().trim().min(2, 'Nome muito curto').max(200)),
  customerPhone: optionalTrimmedString(z.string().trim().min(8, 'Telefone inválido').max(25)),
  guestEmail: optionalTrimmedString(z.string().trim().email('E-mail inválido').toLowerCase()),
  paymentMethod: z.enum(['pix', 'card', 'cash']),
  notes: optionalTrimmedString(z.string().trim().max(500, 'Observação muito longa')),
});

export type CheckoutIntent = z.infer<typeof checkoutIntentSchema>;
