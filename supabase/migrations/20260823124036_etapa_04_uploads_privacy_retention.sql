-- JK COPYCENTER - Etapa 04
-- Upload intentions, explicit ownership/lifecycle, private access audit and
-- report-only retention. This migration is designed for the isolated local
-- staging stack first. It never removes a Storage object.

begin;

-- Reassert the Etapa 02 least-privilege contract after later schema-wide
-- grants: this trigger function does not need Data API execution privileges.
revoke all on function private.handle_new_user() from service_role;

-- Replace the legacy enum so the lifecycle is explicit and can be enforced in
-- the same transaction. Legacy states remain accepted for old rows.
alter table public.order_files alter column status drop default;
alter type public.file_status rename to file_status_legacy;
create type public.file_status as enum (
  'intended',
  'uploading',
  'processing',
  'ready',
  'rejected',
  'expired',
  'confirmed',
  'error',
  'deleted'
);
alter table public.order_files
  alter column status type public.file_status
  using status::text::public.file_status;
alter table public.order_files
  alter column status set default 'intended'::public.file_status;
drop type public.file_status_legacy;

alter type public.file_type add value if not exists 'pptx';

alter table public.order_files
  alter column storage_path drop not null,
  add column ownership_version smallint,
  add column guest_owner_hash text,
  add column safe_name text,
  add column declared_mime_type text,
  add column detected_mime_type text,
  add column content_sha256 text,
  add column intent_expires_at timestamptz,
  add column processing_started_at timestamptz,
  add column ready_at timestamptz,
  add column rejected_at timestamptz,
  add column rejection_code text,
  add column processing_metadata jsonb not null default '{}'::jsonb,
  add column cleanup_required boolean not null default false,
  add column storage_deleted_at timestamptz,
  add column last_accessed_at timestamptz,
  add column access_count bigint not null default 0;

-- Rows that predate this contract are preserved and classified as legacy. New
-- rows must have exactly one authenticated or guest owner.
update public.order_files set ownership_version = 0 where ownership_version is null;
alter table public.order_files alter column ownership_version set default 1;
alter table public.order_files alter column ownership_version set not null;

alter table public.order_files
  add constraint order_files_owner_v1_check check (
    ownership_version = 0
    or num_nonnulls(user_id, guest_owner_hash) = 1
  ),
  add constraint order_files_guest_owner_hash_check check (
    guest_owner_hash is null or guest_owner_hash ~ '^[a-f0-9]{64}$'
  ),
  add constraint order_files_content_sha256_check check (
    content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'
  ),
  add constraint order_files_safe_name_check check (
    safe_name is null
    or (
      char_length(safe_name) between 1 and 200
      and safe_name !~ '[\\/]'
      and safe_name not in ('.', '..')
    )
  ),
  add constraint order_files_access_count_check check (access_count >= 0),
  add constraint order_files_v1_path_check check (
    ownership_version = 0
    or storage_path is null
    or storage_path ~ '^private/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]bin$'
  ),
  add constraint order_files_ready_metadata_check check (
    ownership_version = 0
    or status not in ('ready', 'confirmed')
    or (
      storage_path is not null
      and detected_mime_type is not null
      and content_sha256 is not null
      and ready_at is not null
      and rejected_at is null
    )
  ),
  add constraint order_files_intent_metadata_check check (
    ownership_version = 0
    or status <> 'intended'
    or (
      storage_path is null
      and intent_expires_at is not null
      and safe_name is not null
      and declared_mime_type is not null
      and size_bytes > 0
    )
  );

create index idx_order_files_guest_owner_hash
  on public.order_files (guest_owner_hash)
  where guest_owner_hash is not null and deleted_at is null;
create index idx_order_files_intent_expiry
  on public.order_files (intent_expires_at)
  where status in ('intended', 'uploading', 'processing');
create index idx_order_files_retention_eligible
  on public.order_files (expires_at)
  where storage_path is not null and storage_deleted_at is null;

create or replace function private.enforce_file_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
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
      or (old.status = 'uploading' and new.status in ('processing', 'rejected', 'expired'))
      or (old.status = 'processing' and new.status in ('ready', 'rejected', 'expired'))
      or (old.status = 'ready' and new.status in ('confirmed', 'expired', 'deleted'))
      or (old.status = 'confirmed' and new.status in ('expired', 'deleted'))
      or (old.status = 'rejected' and new.status in ('expired', 'deleted'))
      or (old.status = 'expired' and new.status = 'deleted')
    ) then
      raise exception 'INVALID_FILE_STATE_TRANSITION: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.enforce_file_lifecycle() from public, anon, authenticated, service_role;
drop trigger if exists trg_enforce_file_lifecycle on public.order_files;
create trigger trg_enforce_file_lifecycle
before update on public.order_files
for each row execute function private.enforce_file_lifecycle();

-- The browser may read safe metadata through RLS, but never Storage paths,
-- guest hashes, content hashes, rejection internals or processing metadata.
revoke all on table public.order_files from anon;
revoke select on table public.order_files from authenticated;
grant select (
  id, order_id, order_item_id, user_id, original_name, mime_type, file_type,
  size_bytes, page_count, page_count_method, is_suspicious, status,
  expires_at, deleted_at, created_at, updated_at, ready_at
) on table public.order_files to authenticated;

create table public.file_access_audit (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references public.order_files(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_admin_id uuid references public.admin_users(id) on delete set null,
  purpose text not null check (purpose in ('customer_download', 'admin_order_preview')),
  outcome text not null check (outcome in ('issued', 'denied', 'storage_error')),
  request_id text,
  expires_in_seconds integer check (expires_in_seconds is null or expires_in_seconds between 30 and 300),
  created_at timestamptz not null default now()
);
alter table public.file_access_audit enable row level security;
revoke all on table public.file_access_audit from public, anon, authenticated;
grant all on table public.file_access_audit to service_role;
create index idx_file_access_audit_file_created
  on public.file_access_audit (file_id, created_at desc);

create or replace function private.record_file_access_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.outcome = 'issued' and new.file_id is not null then
    update public.order_files
    set last_accessed_at = new.created_at,
        access_count = access_count + 1
    where id = new.file_id;
  end if;
  return new;
end;
$function$;
revoke all on function private.record_file_access_counter() from public, anon, authenticated, service_role;
create trigger trg_record_file_access_counter
after insert on public.file_access_audit
for each row execute function private.record_file_access_counter();

create table public.file_retention_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  mode text not null default 'report' check (mode = 'report'),
  status text not null check (status in ('completed', 'failed')),
  eligible_count integer not null default 0 check (eligible_count >= 0),
  expired_intent_count integer not null default 0 check (expired_intent_count >= 0),
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);
alter table public.file_retention_runs enable row level security;
revoke all on table public.file_retention_runs from public, anon, authenticated;
grant all on table public.file_retention_runs to service_role;

-- Report only: this function records eligibility and never mutates order_files
-- or storage.objects. Cleanup remains blocked until a separate approval.
create or replace function private.run_file_retention_report(report_at timestamptz default now())
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  report_id uuid;
  eligible_files integer;
  expired_intents integer;
  report_key text := 'daily:' || to_char(report_at at time zone 'UTC', 'YYYY-MM-DD');
begin
  select count(*) into eligible_files
  from public.order_files
  where storage_path is not null
    and storage_deleted_at is null
    and (
      expires_at <= report_at
      or deleted_at is not null
      or status in ('rejected', 'expired', 'deleted', 'error')
      or cleanup_required
    );

  select count(*) into expired_intents
  from public.order_files
  where storage_path is null
    and status in ('intended', 'uploading', 'processing')
    and intent_expires_at <= report_at;

  insert into public.file_retention_runs (
    run_key, mode, status, eligible_count, expired_intent_count, details
  ) values (
    report_key,
    'report',
    'completed',
    eligible_files,
    expired_intents,
    jsonb_build_object(
      'report_at', report_at,
      'deletion_performed', false,
      'approval_required', true
    )
  )
  on conflict (run_key) do update
  set eligible_count = excluded.eligible_count,
      expired_intent_count = excluded.expired_intent_count,
      details = excluded.details,
      completed_at = now()
  returning id into report_id;

  insert into public.audit_logs (
    admin_user_id, action, entity, entity_id, old_value, new_value, ip_address
  ) values (
    null,
    'file_retention_report',
    'file_retention_runs',
    report_id,
    null,
    jsonb_build_object(
      'eligible_count', eligible_files,
      'expired_intent_count', expired_intents,
      'deletion_performed', false
    ),
    null::inet
  );
  return report_id;
end;
$function$;

revoke all on function private.run_file_retention_report(timestamptz)
from public, anon, authenticated, service_role;
drop function if exists private.mark_expired_files_as_deleted();

-- Lifecycle expiry is non-destructive: it only closes authorization. Storage
-- deletion remains outside every scheduled job until separately approved.
create or replace function private.expire_file_lifecycle(expire_at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  changed_count integer;
begin
  with changed as (
    update public.order_files
    set status = 'expired'
    where (
      status in ('intended', 'uploading', 'processing')
      and intent_expires_at <= expire_at
    ) or (
      status in ('ready', 'confirmed')
      and expires_at <= expire_at
    )
    returning id
  )
  select count(*) into changed_count from changed;
  if changed_count > 0 then
    insert into public.audit_logs (
      admin_user_id, action, entity, entity_id, old_value, new_value, ip_address
    ) values (
      null, 'file_lifecycle_expired', 'order_files', null, null,
      jsonb_build_object('expired_count', changed_count, 'storage_deleted', false), null::inet
    );
  end if;
  return changed_count;
end;
$function$;
revoke all on function private.expire_file_lifecycle(timestamptz)
from public, anon, authenticated, service_role;

do $migration$
declare
  existing_job record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for existing_job in
      select jobid from cron.job
      where jobname in ('retention-cleanup-db', 'file-retention-report', 'file-lifecycle-expiry')
    loop
      perform cron.unschedule(existing_job.jobid);
    end loop;
    perform cron.schedule(
      'file-retention-report',
      '15 3 * * *',
      'select private.run_file_retention_report();'
    );
    perform cron.schedule(
      'file-lifecycle-expiry',
      '*/15 * * * *',
      'select private.expire_file_lifecycle();'
    );
  end if;
end;
$migration$;

-- Operational limits are server-controlled and not exposed to the browser.
insert into public.store_settings (
  key, value, value_type, value_schema, description, allowed_roles, is_sensitive
) values
  ('upload_intent_expiry_minutes', '30'::jsonb, 'number', '{"minimum":5,"maximum":120}'::jsonb, 'Validade da intenção de upload em minutos', array['super_admin']::public.admin_role[], false),
  ('upload_processing_timeout_ms', '10000'::jsonb, 'number', '{"minimum":1000,"maximum":30000}'::jsonb, 'Timeout do worker isolado', array['super_admin']::public.admin_role[], false),
  ('upload_processing_memory_mb', '128'::jsonb, 'number', '{"minimum":64,"maximum":256}'::jsonb, 'Memória máxima do worker isolado', array['super_admin']::public.admin_role[], false),
  ('upload_max_concurrent_processing', '2'::jsonb, 'number', '{"minimum":1,"maximum":8}'::jsonb, 'Máximo de workers de arquivo por instância', array['super_admin']::public.admin_role[], false),
  ('upload_max_entries', '200'::jsonb, 'number', '{"minimum":1,"maximum":1000}'::jsonb, 'Máximo de entradas em arquivo contêiner', array['super_admin']::public.admin_role[], false),
  ('upload_max_depth', '1'::jsonb, 'number', '{"minimum":0,"maximum":2}'::jsonb, 'Profundidade máxima de contêiner', array['super_admin']::public.admin_role[], false),
  ('upload_max_uncompressed_bytes', '524288000'::jsonb, 'number', '{"minimum":52428800,"maximum":1073741824}'::jsonb, 'Total máximo descompactado', array['super_admin']::public.admin_role[], false)
on conflict (key) do update
set value = excluded.value,
    value_type = excluded.value_type,
    value_schema = excluded.value_schema,
    description = excluded.description,
    allowed_roles = excluded.allowed_roles,
    is_sensitive = excluded.is_sensitive,
    updated_at = now();

update public.store_settings
set value = '120'::jsonb,
    value_schema = '{"minimum":30,"maximum":300}'::jsonb,
    description = 'Validade curta da URL assinada privada em segundos',
    updated_at = now()
where key = 'signed_url_expiry_seconds';

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
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.rar',
      'application/x-rar-compressed'
    ]::text[]
where id = 'order-files';

commit;
