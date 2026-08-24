-- JK Copycenter - ETAPA 01 / Contencao P0
-- Aplicar primeiro em staging. A producao requer revisao humana e autorizacao.

begin;

-- Desde 2026, novos stacks nao auto-expoem tabelas para a Data API. Declarar
-- grants minimos preserva o comportamento legitimo sem reabrir escrita P0.
grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.categories,
  public.products,
  public.services,
  public.service_fields,
  public.attribute_groups,
  public.attributes,
  public.pricing_rules,
  public.pricing_rule_attributes,
  public.pricing_discounts
to anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.addresses,
  public.favorite_orders,
  public.cart_items
to authenticated;

grant select on table
  public.admin_users,
  public.orders,
  public.order_items,
  public.order_files,
  public.order_events,
  public.system_config,
  public.audit_logs
to authenticated;

grant all privileges on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- Funcoes internas deixam o schema exposto pela Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- Remover acesso guest direto e policies que aceitam inserts arbitrarios.
-- O fluxo guest existente continua exclusivamente pelas rotas server-side com service_role.
drop policy if exists "Orders select guest" on public.orders;
drop policy if exists "Order_items select" on public.order_items;
drop policy if exists "Order_files select" on public.order_files;
drop policy if exists "Order_events select" on public.order_events;

drop policy if exists "Orders insert any" on public.orders;
drop policy if exists "Order_items insert" on public.order_items;
drop policy if exists "Order_files insert" on public.order_files;
drop policy if exists "Client: insert own order_files" on public.order_files;

-- O bucket privado so pode ser acessado pelas rotas server-side autorizadas.
drop policy if exists "Order files insert" on storage.objects;
drop policy if exists "Order files select" on storage.objects;
drop policy if exists "Order files delete admin" on storage.objects;
drop policy if exists "Storage: client upload order-files" on storage.objects;
drop policy if exists "Storage: client read own order-files" on storage.objects;

-- Mover SECURITY DEFINER internas para schema nao exposto. Dependencias de
-- triggers e policies sao atualizadas pelo PostgreSQL durante ALTER FUNCTION.
alter function public.get_admin_role() set schema private;
alter function public.is_admin() set schema private;
alter function public.is_super_admin() set schema private;
alter function public.check_guest_order_access(uuid, text) set schema private;
alter function public.handle_new_user() set schema private;
alter function public.create_order_transaction(jsonb, jsonb, jsonb, jsonb) set schema private;
alter function public.mark_expired_files_as_deleted() set schema private;

alter function private.get_admin_role() set search_path = pg_catalog, public;
alter function private.is_admin() set search_path = pg_catalog, public;
alter function private.is_super_admin() set search_path = pg_catalog, public;
alter function private.check_guest_order_access(uuid, text) set search_path = pg_catalog, public;
alter function private.handle_new_user() set search_path = pg_catalog, public;
alter function private.create_order_transaction(jsonb, jsonb, jsonb, jsonb) set search_path = pg_catalog, public;
alter function private.mark_expired_files_as_deleted() set search_path = pg_catalog, public;

-- Helpers usados por RLS continuam disponiveis somente para sessoes
-- autenticadas; o schema private nao faz parte dos schemas expostos pela API.
revoke all on function private.get_admin_role() from public, anon, authenticated, service_role;
revoke all on function private.is_admin() from public, anon, authenticated, service_role;
revoke all on function private.is_super_admin() from public, anon, authenticated, service_role;
revoke all on function private.check_guest_order_access(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;
revoke all on function private.create_order_transaction(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.mark_expired_files_as_deleted() from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;
grant execute on function private.get_admin_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_super_admin() to authenticated;

-- Toda policy administrativa passa a ser aplicavel apenas a authenticated.
-- Isso evita que anon precise de acesso aos helpers privados para ler catalogo.
do $migration$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where coalesce(qual, '') ~ '(private\.)?(get_admin_role|is_admin|is_super_admin)'
       or coalesce(with_check, '') ~ '(private\.)?(get_admin_role|is_admin|is_super_admin)'
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$migration$;

-- RPC de checkout arbitraria fica suspensa. O checkout atual nao a chama.
-- next_order_number permanece apenas para o backend service_role.
revoke all on function public.next_order_number() from public, anon, authenticated;
grant execute on function public.next_order_number() to service_role;
alter function public.next_order_number() set search_path = pg_catalog, public;
alter function public.generate_order_number() set search_path = pg_catalog, public;
alter function public.update_updated_at() set search_path = pg_catalog, public;

-- Atualizar o job local para o novo nome qualificado da funcao interna.
do $migration$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('retention-cleanup-db');
    perform cron.schedule(
      'retention-cleanup-db',
      '0 3 * * *',
      'select private.mark_expired_files_as_deleted();'
    );
  end if;
exception
  when others then
    raise notice 'pg_cron schedule notice: %', sqlerrm;
end;
$migration$;

-- Limites no proprio Storage complementam (nao substituem) a validacao da API.
update storage.buckets
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/x-rar-compressed'
    ]::text[]
where id = 'order-files';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/png',
      'image/jpeg',
      'image/webp'
    ]::text[]
where id = 'public-assets';

commit;
