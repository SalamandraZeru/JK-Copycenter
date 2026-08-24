-- JK Copycenter - ETAPA 02 / Auth, RBAC, RLS e acesso guest
-- Aplicar primeiro em staging isolado. Producao requer revisao humana.

begin;

-- O codigo de consulta guest e um UUID aleatorio combinado com e-mail
-- normalizado. Ele expira e nunca deve ser enviado em URL ou WhatsApp.
alter table public.orders
  add column if not exists guest_access_expires_at timestamptz;

update public.orders
set guest_email = lower(btrim(guest_email)),
    guest_access_expires_at = coalesce(guest_access_expires_at, created_at + interval '30 days')
where user_id is null;

alter table public.orders
  alter column guest_access_expires_at drop default;

alter table public.orders
  drop constraint if exists orders_guest_identity_check,
  add constraint orders_guest_identity_check check (
    user_id is not null
    or (
      guest_email is not null
      and guest_email = lower(btrim(guest_email))
      and guest_access_expires_at is not null
    )
    or (guest_email is null and guest_access_expires_at is null)
  );

create table if not exists public.guest_access_attempts (
  id bigint generated always as identity primary key,
  order_code_hash text not null check (char_length(order_code_hash) = 64),
  request_hash text not null check (char_length(request_hash) = 64),
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_guest_access_attempts_code_time
  on public.guest_access_attempts (order_code_hash, created_at desc);
create index if not exists idx_guest_access_attempts_request_time
  on public.guest_access_attempts (request_hash, created_at desc);

alter table public.guest_access_attempts enable row level security;

-- A pasta migrations e a unica fonte executavel. Reconstituir as ACLs da
-- Data API do zero evita privilegios residuais (TRUNCATE/TRIGGER/REFERENCES).
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;

grant select on table
  public.categories,
  public.products,
  public.services,
  public.service_fields,
  public.attribute_groups,
  public.attributes
to anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table
  public.addresses,
  public.favorite_orders,
  public.cart_items
to authenticated;

grant select on table
  public.admin_users,
  public.orders,
  public.order_items,
  public.order_files,
  public.order_events
to authenticated;

grant all privileges on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- Remover todas as policies historicas duplicadas e recriar uma matriz curta,
-- explicita e auditavel. Toda tabela publica permanece com RLS habilitado.
do $migration$
declare
  table_row record;
  policy_row record;
begin
  for table_row in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_row.tablename);
  end loop;

  for policy_row in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end;
$migration$;

-- Catalogo publico: somente registros ativos e nao excluidos.
create policy categories_public_read
  on public.categories for select
  to anon, authenticated
  using (is_active = true);

create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (is_active = true and deleted_at is null);

create policy services_public_read
  on public.services for select
  to anon, authenticated
  using (is_active = true and deleted_at is null);

create policy service_fields_public_read
  on public.service_fields for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.services service
      where service.id = service_fields.service_id
        and service.is_active = true
        and service.deleted_at is null
    )
  );

create policy attribute_groups_public_read
  on public.attribute_groups for select
  to anon, authenticated
  using (is_active = true);

create policy attributes_public_read
  on public.attributes for select
  to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.attribute_groups attribute_group
      where attribute_group.id = attributes.group_id
        and attribute_group.is_active = true
    )
  );

-- Cliente autenticado: somente seus proprios recursos.
create policy profiles_own_read
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_own_update
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy addresses_own_read
  on public.addresses for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy addresses_own_insert
  on public.addresses for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
create policy addresses_own_update
  on public.addresses for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy addresses_own_delete
  on public.addresses for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy cart_items_own_read
  on public.cart_items for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy cart_items_own_insert
  on public.cart_items for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
create policy cart_items_own_update
  on public.cart_items for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy cart_items_own_delete
  on public.cart_items for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy favorite_orders_own_read
  on public.favorite_orders for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy favorite_orders_own_insert
  on public.favorite_orders for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.orders owned_order
      where owned_order.id = favorite_orders.order_id
        and owned_order.user_id = (select auth.uid())
    )
  );
create policy favorite_orders_own_update
  on public.favorite_orders for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.orders owned_order
      where owned_order.id = favorite_orders.order_id
        and owned_order.user_id = (select auth.uid())
    )
  );
create policy favorite_orders_own_delete
  on public.favorite_orders for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy orders_own_read
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy order_items_own_read
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders owned_order
      where owned_order.id = order_items.order_id
        and owned_order.user_id = (select auth.uid())
    )
  );

create policy order_files_own_read
  on public.order_files for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.orders owned_order
      where owned_order.id = order_files.order_id
        and owned_order.user_id = (select auth.uid())
    )
  );

create policy order_events_own_read
  on public.order_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders owned_order
      where owned_order.id = order_events.order_id
        and owned_order.user_id = (select auth.uid())
    )
  );

-- O browser administrativo so pode confirmar a propria associacao ativa.
-- Todas as demais leituras/escritas administrativas passam por API autenticada
-- com service_role e verificacao atomica de permissao no backend.
create policy admin_users_own_active_read
  on public.admin_users for select
  to authenticated
  using ((select auth.uid()) = id and is_active = true);

-- Helpers antigos deixam de participar da autorizacao RLS. Nao ha acesso
-- direto do browser a administracao nem a consulta guest.
revoke usage on schema private from authenticated;
revoke all on function private.get_admin_role() from authenticated;
revoke all on function private.is_admin() from authenticated;
revoke all on function private.is_super_admin() from authenticated;
revoke all on function private.check_guest_order_access(uuid, text) from authenticated;

-- Corrigir o job de retencao legado: audit_logs.ip_address e INET, portanto
-- a descricao textual anterior fazia o job inteiro falhar ao registrar log.
create or replace function private.mark_expired_files_as_deleted()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_count integer;
begin
  with updated as (
    update public.order_files
    set status = 'deleted', deleted_at = now()
    where expires_at < now() and status <> 'deleted'
    returning id
  )
  select count(*) into v_count from updated;

  if v_count > 0 then
    insert into public.audit_logs (
      admin_user_id, action, entity, entity_id,
      old_value, new_value, ip_address, created_at
    ) values (
      null, 'retention_auto_mark_deleted', 'order_files', null,
      null, jsonb_build_object('marked_count', v_count), null::inet, now()
    );
  end if;
  return v_count;
end;
$function$;

revoke all on function private.mark_expired_files_as_deleted() from public, anon, authenticated, service_role;

-- Sem policies dependentes, os helpers/RPC legados deixam de ter utilidade.
-- A remocao reduz a superficie privilegiada e elimina a falsa alternativa de
-- checkout transacional que estava explicitamente suspensa desde a Etapa 01.
do $migration$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'storage'
      and (
        coalesce(qual, '') ~ '(private\.)?(get_admin_role|is_admin|is_super_admin)'
        or coalesce(with_check, '') ~ '(private\.)?(get_admin_role|is_admin|is_super_admin)'
      )
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$migration$;

drop function if exists private.get_admin_role();
drop function if exists private.is_admin();
drop function if exists private.is_super_admin();
drop function if exists private.check_guest_order_access(uuid, text);
drop function if exists private.create_order_transaction(jsonb, jsonb, jsonb, jsonb);

commit;
