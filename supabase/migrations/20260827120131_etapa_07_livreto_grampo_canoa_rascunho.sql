-- Etapa 7: create a non-public technical starting point only. Commercial
-- materials and values stay intentionally absent until the administrator
-- configures them in the catalog.
with inserted_service as (
  insert into public.services (
    name,
    slug,
    description,
    base_price_cents,
    pricing_fallback_behavior,
    pricing_profile,
    pricing_profile_config,
    catalog_state,
    is_active,
    sort_order
  ) values (
    'Livreto com Grampo Canoa',
    'livreto-grampo-canoa',
    'Rascunho técnico. Configure materiais, regras de preço e revisão antes de publicar.',
    0,
    'block',
    'booklet_imposition',
    jsonb_build_object(
      'page_multiple', 4,
      'min_pages', 4,
      'allow_blank_page_padding', false,
      'requires_customer_approval_for_padding', true
    ),
    'draft',
    false,
    0
  ) on conflict (slug) do nothing
  returning id
), draft_service as (
  select id from inserted_service
  union all
  select id from public.services where slug = 'livreto-grampo-canoa' and deleted_at is null
  limit 1
), template_fields (key, label, field_type, options, is_required, sort_order) as (
  values
    ('formato_fechado', 'Formato fechado', 'text', '[]'::jsonb, true, 10),
    ('orientacao', 'Orientação', 'radio', '[{"value":"vertical","label":"Vertical","is_active":true,"price_effect":{"type":"none"}},{"value":"horizontal","label":"Horizontal","is_active":true,"price_effect":{"type":"none"}}]'::jsonb, true, 20),
    ('grampo_canoa', 'Confirmo acabamento em grampo canoa', 'checkbox', '[]'::jsonb, true, 30)
)
insert into public.service_fields (
  service_id,
  key,
  label,
  field_type,
  options,
  is_required,
  sort_order,
  is_active
)
select
  draft_service.id,
  template_fields.key,
  template_fields.label,
  template_fields.field_type::public.field_type,
  template_fields.options,
  template_fields.is_required,
  template_fields.sort_order,
  true
from draft_service
cross join template_fields
where not exists (
  select 1
  from public.service_fields existing
  where existing.service_id = draft_service.id
    and existing.key = template_fields.key
);
