\set ON_ERROR_STOP on

begin;

do $test$
declare
  invalid_transition_blocked boolean := false;
  owner_change_blocked boolean := false;
  report_id_1 uuid;
  report_id_2 uuid;
  file_id uuid := '40400000-0000-4000-8000-000000000001';
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'file_status' and e.enumlabel = 'intended'
  ) or not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'file_status' and e.enumlabel = 'rejected'
  ) or not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'file_status' and e.enumlabel = 'expired'
  ) then
    raise exception 'lifecycle incompleto';
  end if;

  insert into public.order_files (
    id, ownership_version, guest_owner_hash, original_name, safe_name,
    declared_mime_type, mime_type, file_type, storage_path, size_bytes,
    page_count, page_count_method, status, intent_expires_at
  ) values (
    file_id, 1, repeat('a', 64), 'teste.pdf', 'teste.pdf',
    'application/pdf', 'application/pdf', 'pdf', null, 100,
    0, 'pending_confirmation', 'intended', now() + interval '30 minutes'
  );

  begin
    update public.order_files
    set status = 'ready',
        storage_path = 'private/40400000-0000-4000-8000-000000000001/40400000-0000-4000-8000-000000000002.bin',
        detected_mime_type = 'application/pdf',
        content_sha256 = repeat('b', 64),
        ready_at = now()
    where id = file_id;
  exception when others then
    invalid_transition_blocked := sqlerrm like '%INVALID_FILE_STATE_TRANSITION%';
  end;
  if not invalid_transition_blocked then
    raise exception 'transicao intended -> ready nao foi bloqueada';
  end if;

  update public.order_files
  set status = 'uploading',
      storage_path = 'private/40400000-0000-4000-8000-000000000001/40400000-0000-4000-8000-000000000002.bin'
  where id = file_id;
  update public.order_files set status = 'processing', processing_started_at = now() where id = file_id;
  update public.order_files
  set status = 'ready',
      detected_mime_type = 'application/pdf',
      content_sha256 = repeat('b', 64),
      page_count = 2,
      page_count_method = 'exact',
      ready_at = now(),
      expires_at = now() - interval '1 minute'
  where id = file_id;

  begin
    update public.order_files set guest_owner_hash = repeat('c', 64) where id = file_id;
  exception when others then
    owner_change_blocked := sqlerrm like '%FILE_OWNER_IMMUTABLE%';
  end;
  if not owner_change_blocked then
    raise exception 'owner mutavel';
  end if;

  report_id_1 := private.run_file_retention_report('2099-01-02 03:15:00+00');
  report_id_2 := private.run_file_retention_report('2099-01-02 23:59:00+00');
  if report_id_1 <> report_id_2 then
    raise exception 'relatorio diario nao idempotente';
  end if;
  if not exists (
    select 1 from public.file_retention_runs
    where id = report_id_1 and mode = 'report'
      and eligible_count >= 1
      and details @> '{"deletion_performed":false,"approval_required":true}'::jsonb
  ) then
    raise exception 'relatorio de retencao invalido';
  end if;
  if not exists (select 1 from public.order_files where id = file_id and storage_path is not null) then
    raise exception 'relatorio removeu arquivo sem aprovacao';
  end if;
end;
$test$;

do $test$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'file-retention-report'
      and active
      and command = 'select private.run_file_retention_report();'
  ) then
    raise exception 'job real de relatorio ausente';
  end if;
  if not exists (
    select 1 from cron.job
    where jobname = 'file-lifecycle-expiry'
      and active
      and command = 'select private.expire_file_lifecycle();'
  ) then
    raise exception 'job de expiracao de lifecycle ausente';
  end if;
  if exists (
    select 1 from cron.job
    where command ~* '(delete|remove|mark_expired_files_as_deleted)'
  ) then
    raise exception 'job destrutivo ativo sem aprovacao';
  end if;
  if has_column_privilege('anon', 'public.order_files', 'storage_path', 'select')
     or has_column_privilege('authenticated', 'public.order_files', 'storage_path', 'select') then
    raise exception 'storage_path exposto ao browser';
  end if;
  if not has_column_privilege('authenticated', 'public.order_files', 'original_name', 'select') then
    raise exception 'metadados seguros indisponiveis ao cliente';
  end if;
  if has_table_privilege('anon', 'public.file_access_audit', 'select')
     or has_table_privilege('authenticated', 'public.file_access_audit', 'select')
     or has_table_privilege('anon', 'public.file_retention_runs', 'select')
     or has_table_privilege('authenticated', 'public.file_retention_runs', 'select') then
    raise exception 'auditoria/retencao exposta';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and ('anon' = any(roles) or 'authenticated' = any(roles) or 'public' = any(roles))
      and (qual like '%order-files%' or with_check like '%order-files%')
  ) then
    raise exception 'Storage privado tem policy direta de browser';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'order-files' and public = false and file_size_limit = 52428800
      and 'application/vnd.openxmlformats-officedocument.presentationml.presentation' = any(allowed_mime_types)
  ) then
    raise exception 'bucket privado/limites/MIME incorretos';
  end if;
end;
$test$;

rollback;
select 'ETAPA_04_DATABASE_OK' as result;
