-- Inscrições de notificação push (Web Push). Acesso só pelo servidor (service role).
-- Admin: avisos de pedidos novos. Cliente: avisos de mudança de etapa de um pedido específico.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('admin', 'customer')),
  admin_user_id uuid references public.admin_users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 32),
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0,
  constraint push_subscriptions_owner check (
    (audience = 'admin' and admin_user_id is not null and order_id is null)
    or (audience = 'customer' and order_id is not null and admin_user_id is null)
  )
);

comment on table public.push_subscriptions is 'Aparelhos inscritos em notificações push. Assinaturas de cliente são apagadas quando o pedido termina.';

create unique index push_subscriptions_admin_endpoint_key on public.push_subscriptions (endpoint) where audience = 'admin';
create unique index push_subscriptions_order_endpoint_key on public.push_subscriptions (order_id, endpoint) where audience = 'customer';
create index push_subscriptions_admin_user_idx on public.push_subscriptions (admin_user_id);
create index push_subscriptions_order_idx on public.push_subscriptions (order_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;
