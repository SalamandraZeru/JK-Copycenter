-- The migrated compatibility tree does not yet contain every production path.
-- Keep the strict resolver available in the application, but do not activate
-- it for this published service until the administrator has modeled all paths.
-- Price fallback stays blocked, so an unmapped combination cannot become an
-- order with an inferred commercial value.
update public.services
set
  pricing_profile_config = coalesce(pricing_profile_config, '{}'::jsonb)
    || jsonb_build_object('require_complete_compatibility', false),
  updated_at = timezone('utc', now())
where slug = 'impressao'
  and deleted_at is null;
