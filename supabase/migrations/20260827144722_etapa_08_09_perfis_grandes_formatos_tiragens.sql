-- ETAPAS 08 e 09 — perfis corretos para grandes formatos e impressos por tiragem.
-- Não altera preços, limites de equipamento, materiais ou serviços publicados.
-- Esses dados continuam sendo cadastrados e validados pela operação no painel.

alter table public.services
  drop constraint if exists services_pricing_profile_valid,
  add constraint services_pricing_profile_valid check (
    pricing_profile in (
      'per_page',
      'per_item',
      'per_print_run',
      'per_sheet',
      'per_square_meter',
      'per_linear_meter',
      'binding_by_file_pages',
      'booklet_imposition',
      'manual_quote'
    )
  );

comment on column public.services.pricing_profile is
  'Unidade técnica de cobrança, incluindo tiragem para impressos e metro quadrado para grandes formatos.';
