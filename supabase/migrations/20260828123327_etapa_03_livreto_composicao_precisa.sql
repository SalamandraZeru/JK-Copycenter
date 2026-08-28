-- Etapa 3: contrato explícito de livreto. Este migration mantém o serviço em
-- rascunho, sem preço comercial e sem publicação automática. O administrador
-- deve cadastrar opções, vínculos de compatibilidade e regras aprovadas antes
-- de ativá-lo no catálogo.

update public.services
set
  pricing_fallback_behavior = 'block',
  pricing_profile_config = coalesce(pricing_profile_config, '{}'::jsonb) || jsonb_build_object(
    'page_multiple', 4,
    'min_pages', 4,
    'allow_blank_page_padding', false,
    'requires_customer_approval_for_padding', true,
    'booklet_core_field_keys', jsonb_build_array('cor_miolo', 'papel_miolo'),
    'booklet_cover_field_keys', jsonb_build_array('cor_capa', 'papel_capa', 'laminacao'),
    'booklet_finishing_field_keys', jsonb_build_array('acabamento', 'grampo_canoa'),
    'booklet_cover_pages', 4
  )
where slug = 'livreto-grampo-canoa'
  and deleted_at is null;

with draft_service as (
  select id
  from public.services
  where slug = 'livreto-grampo-canoa'
    and deleted_at is null
), template_fields (key, label, field_type, options, is_required, sort_order) as (
  values
    ('cor_miolo', 'Impressão do miolo', 'select', '[]'::jsonb, true, 40),
    ('papel_miolo', 'Papel do miolo', 'select', '[]'::jsonb, true, 50),
    ('cor_capa', 'Impressão da capa', 'select', '[]'::jsonb, true, 60),
    ('papel_capa', 'Papel da capa', 'select', '[]'::jsonb, true, 70),
    ('laminacao', 'Laminação da capa', 'select', '[]'::jsonb, false, 80),
    ('acabamento', 'Acabamento', 'select', '[]'::jsonb, true, 90)
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
