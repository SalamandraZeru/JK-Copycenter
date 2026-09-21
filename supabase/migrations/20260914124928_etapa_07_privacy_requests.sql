begin;

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique check (protocol ~ '^LGPD-[0-9]{8}-[A-Z0-9]{8}$'),
  request_type text not null check (request_type in (
    'confirmation_access', 'correction', 'deletion_anonymization',
    'sharing_information', 'consent_revocation', 'opposition', 'other'
  )),
  requester_name text not null check (char_length(requester_name) between 2 and 120),
  requester_email text,
  requester_phone text,
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'received' check (status in (
    'received', 'identity_verification', 'in_review', 'fulfilled', 'partially_fulfilled', 'denied', 'closed'
  )),
  identity_verified_at timestamptz,
  assigned_admin_id uuid references public.admin_users(id) on delete set null,
  resolution_summary text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint privacy_request_contact_check check (
    nullif(btrim(requester_email), '') is not null
    or nullif(btrim(requester_phone), '') is not null
  )
);

alter table public.privacy_requests enable row level security;
revoke all on table public.privacy_requests from public, anon, authenticated;
grant all on table public.privacy_requests to service_role;

create index idx_privacy_requests_status_created
  on public.privacy_requests (status, created_at desc);

create trigger trg_privacy_requests_updated_at
before update on public.privacy_requests
for each row execute function public.update_updated_at();

comment on table public.privacy_requests is
  'Solicitações de titulares com contato mínimo. A identidade deve ser verificada fora da resposta pública antes de revelar dados.';

commit;
