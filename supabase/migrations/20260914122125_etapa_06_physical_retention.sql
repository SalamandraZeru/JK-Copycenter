begin;

alter table public.orders
  add column if not exists terminal_at timestamptz;

alter table public.order_files
  add column if not exists retention_due_at timestamptz,
  add column if not exists retention_reason text,
  add column if not exists cleanup_attempts integer not null default 0,
  add column if not exists cleanup_last_attempt_at timestamptz,
  add column if not exists cleanup_last_error text;

alter table public.order_files
  drop constraint if exists order_files_retention_reason_check,
  add constraint order_files_retention_reason_check check (
    retention_reason is null or retention_reason in (
      'orphan_upload', 'order_completed', 'order_cancelled',
      'quote_declined', 'quote_expired', 'quote_cancelled',
      'request_abandoned', 'user_deleted', 'upload_rejected'
    )
  ),
  drop constraint if exists order_files_cleanup_attempts_check,
  add constraint order_files_cleanup_attempts_check check (cleanup_attempts >= 0);

create index if not exists idx_order_files_physical_retention_due
  on public.order_files (retention_due_at, id)
  where storage_path is not null and storage_deleted_at is null;

alter table public.file_retention_runs
  drop constraint if exists file_retention_runs_mode_check,
  add constraint file_retention_runs_mode_check check (mode in ('report', 'dry_run', 'execute')),
  drop constraint if exists file_retention_runs_status_check,
  add constraint file_retention_runs_status_check check (status in ('running', 'completed', 'partial', 'failed')),
  add column if not exists processed_count integer not null default 0,
  add column if not exists deleted_count integer not null default 0,
  add column if not exists missing_count integer not null default 0,
  add column if not exists failed_count integer not null default 0;

alter table public.file_retention_runs
  drop constraint if exists file_retention_runs_processed_count_check,
  add constraint file_retention_runs_processed_count_check check (processed_count >= 0),
  drop constraint if exists file_retention_runs_deleted_count_check,
  add constraint file_retention_runs_deleted_count_check check (deleted_count >= 0),
  drop constraint if exists file_retention_runs_missing_count_check,
  add constraint file_retention_runs_missing_count_check check (missing_count >= 0),
  drop constraint if exists file_retention_runs_failed_count_check,
  add constraint file_retention_runs_failed_count_check check (failed_count >= 0);

-- O marco terminal é congelado na primeira conclusão/cancelamento/decisão final.
-- Isso impede que alterações administrativas posteriores empurrem a exclusão.
create or replace function private.apply_order_file_retention_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_terminal_at timestamptz;
begin
  if new.status = 'completed' then
    v_reason := 'order_completed';
  elsif new.status = 'cancelled' then
    v_reason := 'order_cancelled';
  elsif new.order_kind = 'graphic_quote' and new.quote_status = 'declined' then
    v_reason := 'quote_declined';
  elsif new.order_kind = 'graphic_quote' and new.quote_status = 'expired' then
    v_reason := 'quote_expired';
  elsif new.order_kind = 'graphic_quote' and new.quote_status = 'cancelled' then
    v_reason := 'quote_cancelled';
  else
    return new;
  end if;

  v_terminal_at := coalesce(old.terminal_at, new.terminal_at, now());
  new.terminal_at := v_terminal_at;

  update public.order_files
  set retention_due_at = v_terminal_at + interval '15 days',
      retention_reason = v_reason,
      expires_at = v_terminal_at + interval '15 days'
  where order_id = new.id
    and storage_path is not null
    and storage_deleted_at is null;

  return new;
end;
$$;

revoke all on function private.apply_order_file_retention_deadline()
from public, anon, authenticated, service_role;

drop trigger if exists trg_apply_order_file_retention_deadline on public.orders;
create trigger trg_apply_order_file_retention_deadline
before insert or update of status, quote_status on public.orders
for each row execute function private.apply_order_file_retention_deadline();

-- Ao vincular um arquivo, o prazo deixa de contar do upload. Um pedido ativo
-- mantém o arquivo disponível até atingir um estado terminal.
create or replace function private.sync_linked_file_retention_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_reason text;
begin
  if new.order_id is null then
    if new.deleted_at is not null then
      new.retention_due_at := least(coalesce(new.retention_due_at, new.deleted_at), new.deleted_at);
      new.retention_reason := 'user_deleted';
    elsif new.status = 'rejected' then
      new.retention_due_at := now();
      new.retention_reason := 'upload_rejected';
    elsif new.storage_path is not null and new.retention_due_at is null then
      new.retention_due_at := coalesce(new.intent_expires_at, new.created_at) + interval '24 hours';
      new.retention_reason := 'orphan_upload';
    end if;
    return new;
  end if;

  select status, quote_status, order_kind, terminal_at, created_at
  into v_order
  from public.orders
  where id = new.order_id;

  if not found then return new; end if;

  if v_order.status = 'completed' then v_reason := 'order_completed';
  elsif v_order.status = 'cancelled' then v_reason := 'order_cancelled';
  elsif v_order.order_kind = 'graphic_quote' and v_order.quote_status = 'declined' then v_reason := 'quote_declined';
  elsif v_order.order_kind = 'graphic_quote' and v_order.quote_status = 'expired' then v_reason := 'quote_expired';
  elsif v_order.order_kind = 'graphic_quote' and v_order.quote_status = 'cancelled' then v_reason := 'quote_cancelled';
  elsif v_order.order_kind = 'graphic_quote' and v_order.quote_status in ('pending', 'negotiating')
        and v_order.created_at <= now() - interval '15 days' then v_reason := 'request_abandoned';
  end if;

  if v_reason is null then
    new.retention_due_at := null;
    new.retention_reason := null;
    new.expires_at := null;
  else
    new.retention_due_at := coalesce(v_order.terminal_at, v_order.created_at, now()) + interval '15 days';
    new.retention_reason := v_reason;
    new.expires_at := new.retention_due_at;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_linked_file_retention_deadline()
from public, anon, authenticated, service_role;

drop trigger if exists trg_sync_linked_file_retention_deadline on public.order_files;
create trigger trg_sync_linked_file_retention_deadline
before insert or update of order_id, deleted_at, status, storage_path on public.order_files
for each row execute function private.sync_linked_file_retention_deadline();

-- Permite reconciliar uma falha de processamento depois que o objeto físico
-- foi confirmado como ausente.
create or replace function private.enforce_file_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.ownership_version = 1 and new.ownership_version <> old.ownership_version then
    raise exception 'FILE_OWNERSHIP_IMMUTABLE';
  end if;
  if old.ownership_version = 1
     and (new.user_id is distinct from old.user_id
          or new.guest_owner_hash is distinct from old.guest_owner_hash) then
    raise exception 'FILE_OWNER_IMMUTABLE';
  end if;

  if new.status is distinct from old.status and old.ownership_version = 1 then
    if not (
      (old.status = 'intended' and new.status in ('uploading', 'rejected', 'expired'))
      or (old.status = 'uploading' and new.status in ('processing', 'rejected', 'expired', 'deleted'))
      or (old.status = 'processing' and new.status in ('ready', 'rejected', 'expired', 'deleted'))
      or (old.status = 'ready' and new.status in ('confirmed', 'expired', 'deleted'))
      or (old.status = 'confirmed' and new.status in ('expired', 'deleted'))
      or (old.status = 'rejected' and new.status in ('expired', 'deleted'))
      or (old.status in ('expired', 'error') and new.status = 'deleted')
    ) then
      raise exception 'INVALID_FILE_STATE_TRANSITION: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_file_lifecycle()
from public, anon, authenticated, service_role;

-- Backfill conservador: pedidos ativos não recebem prazo; terminais usam o
-- último timestamp conhecido. Uploads sem pedido usam a janela de 24 horas.
update public.orders
set terminal_at = updated_at
where terminal_at is null
  and (
    status in ('completed', 'cancelled')
    or (order_kind = 'graphic_quote' and quote_status in ('declined', 'expired', 'cancelled'))
  );

update public.order_files f
set retention_due_at = case
      when o.id is null then coalesce(f.intent_expires_at, f.created_at) + interval '24 hours'
      when o.terminal_at is not null then o.terminal_at + interval '15 days'
      when o.order_kind = 'graphic_quote' and o.quote_status in ('pending', 'negotiating')
           and o.created_at <= now() - interval '15 days' then o.created_at + interval '15 days'
      else null
    end,
    retention_reason = case
      when o.id is null and f.deleted_at is not null then 'user_deleted'
      when o.id is null and f.status = 'rejected' then 'upload_rejected'
      when o.id is null then 'orphan_upload'
      when o.status = 'completed' then 'order_completed'
      when o.status = 'cancelled' then 'order_cancelled'
      when o.quote_status = 'declined' then 'quote_declined'
      when o.quote_status = 'expired' then 'quote_expired'
      when o.quote_status = 'cancelled' then 'quote_cancelled'
      when o.order_kind = 'graphic_quote' and o.quote_status in ('pending', 'negotiating')
           and o.created_at <= now() - interval '15 days' then 'request_abandoned'
      else null
    end,
    expires_at = case
      when o.id is null then coalesce(f.intent_expires_at, f.created_at) + interval '24 hours'
      when o.terminal_at is not null then o.terminal_at + interval '15 days'
      when o.order_kind = 'graphic_quote' and o.quote_status in ('pending', 'negotiating')
           and o.created_at <= now() - interval '15 days' then o.created_at + interval '15 days'
      else null
    end
from public.orders o
where f.order_id is not distinct from o.id
  and f.storage_path is not null
  and f.storage_deleted_at is null;

-- A cláusula acima não alcança órfãos porque o FROM não produz linha para NULL.
update public.order_files
set retention_due_at = coalesce(intent_expires_at, created_at) + interval '24 hours',
    retention_reason = case
      when deleted_at is not null then 'user_deleted'
      when status = 'rejected' then 'upload_rejected'
      else 'orphan_upload'
    end,
    expires_at = coalesce(intent_expires_at, created_at) + interval '24 hours'
where order_id is null
  and storage_path is not null
  and storage_deleted_at is null;

insert into public.system_config (key, value, description)
values ('data_retention_days', '15', 'Prazo de retenção física dos arquivos após o marco terminal do pedido')
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();

comment on column public.order_files.retention_due_at is
  'Momento em que o objeto pode ser fisicamente eliminado; NULL enquanto o pedido está ativo.';
comment on column public.order_files.cleanup_last_error is
  'Código operacional sanitizado da última falha; nunca deve conter nome, caminho, token ou PII.';

create or replace function public.increment_file_cleanup_failure(
  p_file_id uuid,
  p_attempted_at timestamptz,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_error_code !~ '^[A-Z][A-Z0-9_]{2,63}$' then
    raise exception using errcode = '22023', message = 'RETENTION_ERROR_CODE_INVALID';
  end if;
  update public.order_files
  set cleanup_required = true,
      cleanup_attempts = cleanup_attempts + 1,
      cleanup_last_attempt_at = p_attempted_at,
      cleanup_last_error = p_error_code
  where id = p_file_id
    and storage_deleted_at is null;
end;
$$;

revoke all on function public.increment_file_cleanup_failure(uuid, timestamptz, text)
from public, anon, authenticated;
grant execute on function public.increment_file_cleanup_failure(uuid, timestamptz, text)
to service_role;

commit;
