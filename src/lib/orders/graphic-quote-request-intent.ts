import { z } from 'zod';
import { digitsOnly } from '@/lib/forms/brazil';

const fieldValueSchema = z.object({
  fieldKey: z.string().trim().min(1).max(100),
  value: z.union([z.string().max(5_000), z.number().finite(), z.boolean()]),
}).strict();

const dimensionsSchema = z.object({
  widthCm: z.number().finite().positive().max(100_000).optional(),
  heightCm: z.number().finite().positive().max(100_000).optional(),
  lengthCm: z.number().finite().positive().max(100_000).optional(),
}).strict();

const quoteItemSchema = z.object({
  serviceId: z.string().uuid('Serviço inválido.'),
  fieldValues: z.array(fieldValueSchema).max(100).default([]),
  quantity: z.number().int().min(1).max(100_000_000),
  fileIds: z.array(z.string().uuid()).min(1, 'Anexe ao menos um arquivo.').max(100),
  bindingFileIds: z.array(z.string().uuid()).max(100).default([]),
  dimensions: dimensionsSchema.default({}),
  bookletPaddingApproved: z.boolean().default(false),
  artworkBleedAcknowledged: z.boolean().default(false),
}).strict().superRefine((item, context) => {
  const files = new Set(item.fileIds);
  if (files.size !== item.fileIds.length) {
    context.addIssue({ code: 'custom', message: 'Arquivo repetido no item.', path: ['fileIds'] });
  }
  if (new Set(item.bindingFileIds).size !== item.bindingFileIds.length
      || item.bindingFileIds.some((fileId) => !files.has(fileId))) {
    context.addIssue({ code: 'custom', message: 'Arquivo de encadernação inválido.', path: ['bindingFileIds'] });
  }
});

const optionalTrimmed = (schema: z.ZodString) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  schema.optional(),
);

const optionalBrazilianPhone = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const digits = digitsOnly(value);
    return digits === '' ? undefined : digits;
  },
  z.string().min(10, 'Telefone inválido.').max(11, 'Telefone inválido.').optional(),
);

export const graphicQuoteRequestIntentSchema = z.object({
  idempotencyKey: z.string().uuid('Chave de idempotência inválida.'),
  items: z.array(quoteItemSchema).min(1).max(100),
  customerName: optionalTrimmed(z.string().trim().min(2).max(200)),
  customerPhone: optionalBrazilianPhone,
  guestEmail: optionalTrimmed(z.string().trim().email().toLowerCase()),
  notes: optionalTrimmed(z.string().trim().max(500)),
}).strict().superRefine((request, context) => {
  const allFiles = request.items.flatMap((item) => item.fileIds);
  if (allFiles.length > 100) {
    context.addIssue({ code: 'custom', message: 'O limite é de 100 arquivos por solicitação.', path: ['items'] });
  }
  if (new Set(allFiles).size !== allFiles.length) {
    context.addIssue({ code: 'custom', message: 'Cada arquivo pode pertencer a apenas um item.', path: ['items'] });
  }
});

export type GraphicQuoteRequestIntent = z.infer<typeof graphicQuoteRequestIntentSchema>;

