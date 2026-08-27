begin;

-- Registro operacional mínimo: comprova que um template de status foi aberto
-- pelo time, sem armazenar telefone, mensagem, endereço, URL assinada ou
-- qualquer conteúdo sensível da conversa externa.
create table public.order_status_communications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  admin_user_id uuid references public.admin_users(id) on delete set null,
  idempotency_key uuid not null,
  channel text not null check (channel in ('whatsapp')),
  status_to public.order_status not null,
  template_key text not null check (template_key ~ '^[a-z][a-z0-9_]{0,99}$'),
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint order_status_communications_order_idempotency_unique unique (order_id, idempotency_key)
);

create index order_status_communications_order_created_idx
  on public.order_status_communications(order_id, created_at desc);

alter table public.order_status_communications enable row level security;
revoke all on table public.order_status_communications from public, anon, authenticated;
grant all on table public.order_status_communications to service_role;

comment on table public.order_status_communications is
  'Log mínimo de abertura de comunicação operacional por status; não armazena destinatário, conteúdo nem URL de arquivo.';

commit;
