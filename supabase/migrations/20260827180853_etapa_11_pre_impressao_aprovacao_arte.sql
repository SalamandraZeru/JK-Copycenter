begin;

alter table public.orders
  add column if not exists artwork_status text not null default 'not_required',
  add column if not exists artwork_updated_at timestamptz;

alter table public.orders
  add constraint orders_artwork_status_check
    check (artwork_status in ('not_required', 'received', 'in_review', 'correction_requested', 'awaiting_customer_approval', 'approved_for_production')) not valid;
alter table public.orders validate constraint orders_artwork_status_check;

create table if not exists public.order_file_preflight_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_file_id uuid not null references public.order_files(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete set null,
  file_content_sha256 text not null check (file_content_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'correction_requested', 'awaiting_customer_approval', 'approved_for_production', 'superseded')),
  automation_summary jsonb not null default '{}'::jsonb,
  structure_summary jsonb not null default '{}'::jsonb,
  graphics_summary jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  customer_approval_required boolean not null default true,
  staff_note text,
  reviewed_by uuid references public.admin_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_file_id)
);

create index if not exists order_file_preflight_reports_order_status_idx
  on public.order_file_preflight_reports(order_id, status);

create table if not exists public.order_artwork_approvals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  report_id uuid not null references public.order_file_preflight_reports(id) on delete cascade,
  order_file_id uuid not null references public.order_files(id) on delete restrict,
  approved_file_sha256 text not null check (approved_file_sha256 ~ '^[a-f0-9]{64}$'),
  decision text not null check (decision in ('approved', 'correction_requested')),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  guest_email text,
  note text,
  created_at timestamptz not null default now(),
  check ((approved_by_user_id is null) <> (guest_email is null))
);

create index if not exists order_artwork_approvals_report_idx
  on public.order_artwork_approvals(report_id, created_at desc);

alter table public.order_file_preflight_reports enable row level security;
alter table public.order_artwork_approvals enable row level security;
revoke all on table public.order_file_preflight_reports from public, anon;
revoke all on table public.order_artwork_approvals from public, anon;
grant select on table public.order_file_preflight_reports to authenticated;
grant select on table public.order_artwork_approvals to authenticated;
grant all on table public.order_file_preflight_reports to service_role;
grant all on table public.order_artwork_approvals to service_role;

drop policy if exists order_file_preflight_reports_customer_read on public.order_file_preflight_reports;
create policy order_file_preflight_reports_customer_read
  on public.order_file_preflight_reports for select to authenticated
  using (exists (
    select 1 from public.orders order_row
    where order_row.id = order_file_preflight_reports.order_id
      and order_row.user_id = auth.uid()
  ));

drop policy if exists order_artwork_approvals_customer_read on public.order_artwork_approvals;
create policy order_artwork_approvals_customer_read
  on public.order_artwork_approvals for select to authenticated
  using (exists (
    select 1 from public.orders order_row
    where order_row.id = order_artwork_approvals.order_id
      and order_row.user_id = auth.uid()
  ));

create or replace function private.refresh_order_artwork_status(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next_status text;
begin
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  if not exists (select 1 from public.order_file_preflight_reports where order_id = p_order_id) then
    v_next_status := 'not_required';
  elsif exists (select 1 from public.order_file_preflight_reports where order_id = p_order_id and status = 'correction_requested') then
    v_next_status := 'correction_requested';
  elsif exists (select 1 from public.order_file_preflight_reports where order_id = p_order_id and status = 'pending_review') then
    v_next_status := 'in_review';
  elsif exists (select 1 from public.order_file_preflight_reports where order_id = p_order_id and status = 'awaiting_customer_approval') then
    v_next_status := 'awaiting_customer_approval';
  elsif exists (select 1 from public.order_file_preflight_reports where order_id = p_order_id and status <> 'superseded') then
    v_next_status := 'approved_for_production';
  else
    v_next_status := 'not_required';
  end if;

  update public.orders
  set artwork_status = v_next_status, artwork_updated_at = now(), updated_at = now()
  where id = p_order_id;
  return v_next_status;
end;
$$;

create or replace function private.create_preflight_report_for_linked_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_id is null or old.order_id is not null or new.status not in ('ready', 'confirmed') then
    return new;
  end if;

  -- A corrected replacement applies to the same order item. Preserve the old
  -- decision in order_artwork_approvals but take the rejected version out of
  -- the active artwork gate before creating a report for the new hash.
  if new.order_item_id is not null then
    update public.order_file_preflight_reports
    set status = 'superseded', updated_at = now()
    where order_id = new.order_id
      and order_item_id = new.order_item_id
      and status = 'correction_requested';
  end if;

  insert into public.order_file_preflight_reports (
    order_id,
    order_file_id,
    order_item_id,
    file_content_sha256,
    automation_summary,
    structure_summary,
    graphics_summary,
    findings
  ) values (
    new.order_id,
    new.id,
    new.order_item_id,
    new.content_sha256,
    jsonb_build_object(
      'securityChecks', jsonb_build_array('magic_bytes', 'size_limit', 'isolated_processing'),
      'antivirus', 'not_configured',
      'automaticStatus', case when new.is_suspicious then 'manual_review_required' else 'passed_structural_security' end
    ),
    jsonb_build_object(
      'pageCount', new.page_count,
      'pageCountMethod', new.page_count_method::text,
      'processor', coalesce(new.processing_metadata ->> 'processor', 'unknown'),
      'pagesAnalysed', new.processing_metadata -> 'pdfPagesAnalysed',
      'completeStructureScan', coalesce(new.processing_metadata -> 'pdfStructureComplete', 'false'::jsonb),
      'mediaBoxesConsistent', new.processing_metadata -> 'pdfMediaBoxesConsistent',
      'orientationsConsistent', new.processing_metadata -> 'pdfOrientationsConsistent',
      'boxesInsideMedia', new.processing_metadata -> 'pdfBoxesInsideMedia',
      'hasDistinctTrimBox', new.processing_metadata -> 'pdfHasDistinctTrimBox',
      'hasDistinctBleedBox', new.processing_metadata -> 'pdfHasDistinctBleedBox'
    ),
    jsonb_build_object(
      'status', 'manual_review_required',
      'notAutomaticallyVerified', jsonb_build_array('font_embedding', 'image_resolution_dpi', 'colour_space', 'transparency', 'safe_area_content')
    ),
    jsonb_build_array(jsonb_build_object(
      'code', 'GRAPHIC_REVIEW_REQUIRED',
      'severity', 'info',
      'message', 'Fontes, resolução, cor, transparências e área segura exigem revisão humana nesta infraestrutura.'
    ))
  ) on conflict (order_file_id) do nothing;

  perform private.refresh_order_artwork_status(new.order_id);
  return new;
end;
$$;

revoke all on function private.refresh_order_artwork_status(uuid) from public, anon, authenticated, service_role;
revoke all on function private.create_preflight_report_for_linked_file() from public, anon, authenticated, service_role;
drop trigger if exists trg_create_preflight_report_for_linked_file on public.order_files;
create trigger trg_create_preflight_report_for_linked_file
after update of order_id on public.order_files
for each row execute function private.create_preflight_report_for_linked_file();

create or replace function private.refresh_order_artwork_status_from_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_order_artwork_status(new.order_id);
  return new;
end;
$$;

revoke all on function private.refresh_order_artwork_status_from_report() from public, anon, authenticated, service_role;
drop trigger if exists trg_refresh_order_artwork_status_from_report on public.order_file_preflight_reports;
create trigger trg_refresh_order_artwork_status_from_report
after insert or update of status on public.order_file_preflight_reports
for each row execute function private.refresh_order_artwork_status_from_report();

-- The preceding inventory wrapper remains the transaction owner. Add the
-- artwork gate without changing permitted operational transitions themselves.
alter function public.transition_order_status(uuid, uuid, public.order_status, text, uuid, boolean)
  rename to transition_order_status_inventory_core;
alter function public.transition_order_status_inventory_core(uuid, uuid, public.order_status, text, uuid, boolean)
  set schema private;
revoke all on function private.transition_order_status_inventory_core(uuid, uuid, public.order_status, text, uuid, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_to_status public.order_status,
  p_note text,
  p_idempotency_key uuid,
  p_allow_unpaid_confirmation boolean default false
)
returns table (order_id uuid, order_status public.order_status, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_artwork_status text;
begin
  if p_to_status = 'in_production' then
    select artwork_status into v_artwork_status from public.orders where id = p_order_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
    if v_artwork_status not in ('not_required', 'approved_for_production') then
      raise exception using errcode = 'P0001', message = 'PREPRESS_APPROVAL_REQUIRED';
    end if;
  end if;

  select * into v_result from private.transition_order_status_inventory_core(
    p_order_id, p_admin_user_id, p_to_status, p_note, p_idempotency_key, p_allow_unpaid_confirmation
  );
  return query select v_result.order_id, v_result.order_status, v_result.replayed;
end;
$$;

revoke all on function public.transition_order_status(uuid, uuid, public.order_status, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.transition_order_status(uuid, uuid, public.order_status, text, uuid, boolean) to service_role;

comment on table public.order_file_preflight_reports is 'Pré-impressão rastreável por arquivo e hash; aprovações gráficas não são inferidas da análise estrutural.';
comment on table public.order_artwork_approvals is 'Decisões do cliente associadas ao hash exato do arquivo aprovado ou devolvido para correção.';
comment on column public.orders.artwork_status is 'Fluxo separado de pré-impressão; pedidos com arquivo não entram em produção sem aprovação registrada.';

commit;
