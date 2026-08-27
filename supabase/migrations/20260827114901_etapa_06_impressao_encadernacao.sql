-- Etapa 6: make the currently published print service fail closed until the
-- administrator completes commercial price and compatibility paths. No price,
-- material availability, or binding tier is inferred by this migration.
update public.services
set
  pricing_fallback_behavior = 'block',
  pricing_profile_config = coalesce(pricing_profile_config, '{}'::jsonb)
    || jsonb_build_object('require_complete_compatibility', true),
  updated_at = timezone('utc', now())
where slug = 'impressao'
  and deleted_at is null;

-- Price rules for the published service require these material selections.
-- Marking them mandatory prevents a partial configuration from falling through
-- to an undefined commercial value.
update public.service_fields
set
  is_required = true
where service_id = (select id from public.services where slug = 'impressao' and deleted_at is null limit 1)
  and key in ('tipo_de_papel', 'gramatura');
