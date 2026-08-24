-- supabase/seeds/dev.sql

-- Limpar dados (opcional)
-- TRUNCATE categories, services, service_fields, attribute_groups, attributes, pricing_rules, pricing_rule_attributes, system_config CASCADE;

-- Categorias
INSERT INTO categories (id, name, slug, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'Gráfica', 'grafica', true),
('22222222-2222-2222-2222-222222222222', 'Papelaria', 'papelaria', true)
ON CONFLICT (slug) DO NOTHING;

-- Serviços
INSERT INTO services (id, category_id, name, slug, base_price, is_active)
VALUES 
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Impressão', 'impressao', 0.20, true)
ON CONFLICT (slug) DO NOTHING;

-- Campos do serviço de impressão
INSERT INTO service_fields
  (id, service_id, key, label, field_type, options, is_required, sort_order)
VALUES
  ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333333', 'color', 'Colorido ou P&B', 'radio',
   '[{"value":"color","label":"Colorido","price_effect":{"multiplier":2.5}},
     {"value":"bw","label":"Preto e Branco","price_effect":null}]'::jsonb,
   true, 1),
  ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333333', 'sides', 'Frente e Verso', 'checkbox',
   '[{"value":"both","label":"Frente e Verso",
      "price_effect":{"multiplier":1.8}}]'::jsonb,
   false, 2)
ON CONFLICT DO NOTHING;

-- Grupos de atributos
INSERT INTO attribute_groups (id, name) VALUES
('55555555-5555-5555-5555-555555555551', 'Tamanho'), 
('55555555-5555-5555-5555-555555555552', 'Tipo de Papel'), 
('55555555-5555-5555-5555-555555555553', 'Gramatura')
ON CONFLICT DO NOTHING;

-- Atributos
INSERT INTO attributes (id, group_id, name) VALUES
('66666666-6666-6666-6666-666666666661', '55555555-5555-5555-5555-555555555551', 'A4'), 
('66666666-6666-6666-6666-666666666662', '55555555-5555-5555-5555-555555555551', 'A3'),
('66666666-6666-6666-6666-666666666663', '55555555-5555-5555-5555-555555555552', 'Sulfite'), 
('66666666-6666-6666-6666-666666666664', '55555555-5555-5555-5555-555555555552', 'Couchê'),
('66666666-6666-6666-6666-666666666665', '55555555-5555-5555-5555-555555555553', '75g'), 
('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555553', '90g')
ON CONFLICT DO NOTHING;

-- Regra de preço de exemplo
INSERT INTO pricing_rules
  (id, service_id, name, price_per_page, fallback_behavior, is_active)
VALUES
  ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 'A4 Sulfite 75g', 0.20, 'use_base', true)
ON CONFLICT DO NOTHING;

INSERT INTO pricing_rule_attributes (pricing_rule_id, attribute_id)
VALUES
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666661'),
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666663'),
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666665')
ON CONFLICT DO NOTHING;

-- O configurador público atual não seleciona atributos de catálogo. Mantemos
-- a regra específica para uso administrativo, mas liberamos o preço-base
-- autorizado quando ela não se aplica à configuração enviada pelo cliente.
UPDATE services
SET pricing_fallback_behavior = 'use_base'
WHERE slug = 'impressao';

-- Config do sistema
INSERT INTO system_config (key, value) VALUES
('delivery_city', '"Passos"'),
('delivery_fee', '5.00'),
('pix_key', '"00000000000"'),
('pix_owner_name', '"JK Copycenter"'),
('whatsapp_number', '"5500000000000"'),
('max_upload_size_mb', '50'),
('max_files_per_order', '10'),
('max_zip_uncompressed_mb', '500'),
('price_rounding_mode', '"ceil_cents"'),
('store_name', '"JK Copycenter"'),
('store_address', '"Passos, MG"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- A migração de catálogo ocorre antes deste seed. Repetimos aqui o mínimo
-- operacional tipado para que um reset limpo tenha a mesma fonte de verdade
-- usada pelo checkout server-side. Todos os valores são sintéticos locais.
INSERT INTO store_settings (
  key, value, value_type, value_schema, description, allowed_roles, is_sensitive
) VALUES
  ('pix_key', '"TEST_JK_PIX"', 'string', '{"type":"string"}', 'Chave Pix sintética local', array['super_admin']::admin_role[], true),
  ('pix_owner_name', '"TEST_JK Copycenter"', 'string', '{"type":"string"}', 'Titular Pix sintético local', array['super_admin']::admin_role[], true),
  ('whatsapp_number', '"5500000000000"', 'string', '{"type":"string"}', 'WhatsApp sintético local', array['super_admin','admin']::admin_role[], false),
  ('delivery_fee_cents', '500', 'number', '{"type":"integer"}', 'Taxa sintética local em centavos', array['super_admin','admin']::admin_role[], false),
  ('delivery_city', '"Passos"', 'string', '{"type":"string"}', 'Cidade sintética local', array['super_admin','admin']::admin_role[], false),
  ('delivery_state', '"MG"', 'string', '{"type":"string"}', 'UF sintética local', array['super_admin','admin']::admin_role[], false),
  ('delivery_enabled', 'true', 'boolean', '{"type":"boolean"}', 'Entrega habilitada em desenvolvimento', array['super_admin','admin']::admin_role[], false),
  ('pickup_enabled', 'true', 'boolean', '{"type":"boolean"}', 'Retirada habilitada em desenvolvimento', array['super_admin','admin']::admin_role[], false),
  ('guest_order_access_days', '30', 'number', '{"type":"integer"}', 'Prazo de guest local', array['super_admin']::admin_role[], false)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  value_type = EXCLUDED.value_type,
  value_schema = EXCLUDED.value_schema,
  description = EXCLUDED.description,
  allowed_roles = EXCLUDED.allowed_roles,
  is_sensitive = EXCLUDED.is_sensitive;
