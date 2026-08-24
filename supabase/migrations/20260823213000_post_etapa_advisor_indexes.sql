-- Índices de cobertura para chaves estrangeiras apontadas pelo advisor do Supabase.
-- Não alteram RLS, permissões nem dados.
create index if not exists idx_admin_users_created_by on public.admin_users(created_by);
create index if not exists idx_favorite_orders_order_id on public.favorite_orders(order_id);
create index if not exists idx_file_access_audit_actor_user_id on public.file_access_audit(actor_user_id);
create index if not exists idx_file_access_audit_actor_admin_id on public.file_access_audit(actor_admin_id);
create index if not exists idx_order_items_pricing_rule_id on public.order_items(pricing_rule_id);
create index if not exists idx_order_payment_events_admin_user_id on public.order_payment_events(admin_user_id);
create index if not exists idx_store_settings_updated_by on public.store_settings(updated_by);
create index if not exists idx_system_config_updated_by on public.system_config(updated_by);
