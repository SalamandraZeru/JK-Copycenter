import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { enforceCloudflareRateLimit } from '@/lib/security/cloudflare-rate-limit';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  requestType: z.enum([
    'confirmation_access', 'correction', 'deletion_anonymization',
    'sharing_information', 'consent_revocation', 'opposition', 'other',
  ]),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  details: z.string().trim().max(1000).optional().or(z.literal('')),
  website: z.string().max(0).optional(),
}).strict().superRefine((value, context) => {
  const phoneDigits = value.phone?.replace(/\D/g, '') || '';
  if (!value.email && phoneDigits.length < 10) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Informe e-mail ou telefone.' });
  }
  if (value.phone && (phoneDigits.length < 10 || phoneDigits.length > 13)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: 'Telefone inválido.' });
  }
});

function protocol(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `LGPD-${date}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Revise os dados informados.' }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ success: true, protocol: protocol() }, { status: 202 });
  }

  const limit = await enforceCloudflareRateLimit(
    request,
    'JK_PRIVACY_REQUEST_RATE_LIMIT',
    'privacy-request',
    {},
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Muitas solicitações. Aguarde antes de tentar novamente.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const requestProtocol = protocol();
  const phone = parsed.data.phone?.replace(/\D/g, '') || null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from('privacy_requests').insert({
    protocol: requestProtocol,
    request_type: parsed.data.requestType,
    requester_name: parsed.data.name,
    requester_email: parsed.data.email || null,
    requester_phone: phone,
    details: parsed.data.details || null,
  }).select('id').single();
  if (error || !data) {
    return NextResponse.json({ success: false, error: 'Não foi possível registrar a solicitação.' }, { status: 500 });
  }

  await supabase.from('audit_logs').insert({
    admin_user_id: null,
    action: 'privacy_request_received',
    entity: 'privacy_requests',
    entity_id: data.id,
    old_value: null,
    new_value: { request_type: parsed.data.requestType, status: 'received' },
    ip_address: null,
  });

  return NextResponse.json({ success: true, protocol: requestProtocol }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store, max-age=0', 'Referrer-Policy': 'no-referrer' },
  });
}
