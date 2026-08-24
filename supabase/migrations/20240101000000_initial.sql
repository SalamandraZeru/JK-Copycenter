-- =============================================
-- JK Copycenter V2 — Migration 001 Initial
-- PostgreSQL 15+ (Supabase)
-- =============================================
-- Desenvolvido por Noctem Technology
-- Schema inicial da aplicação.
-- =============================================

-- =============================================
-- 1. ENUMS
-- =============================================

CREATE TYPE order_status AS ENUM (
  'new',
  'in_production',
  'ready',
  'archived',
  'cancelled'
);

CREATE TYPE delivery_type AS ENUM (
  'pickup',
  'delivery'
);

CREATE TYPE admin_role AS ENUM (
  'super_admin',
  'admin',
  'producao',
  'catalogo'
);

CREATE TYPE file_status AS ENUM (
  'uploading',
  'ready',
  'processing',
  'confirmed',
  'error',
  'deleted'
);

CREATE TYPE file_type AS ENUM (
  'pdf',
  'docx',
  'image',
  'zip',
  'rar'
);

CREATE TYPE page_count_method AS ENUM (
  'exact',
  'estimated',
  'pending_confirmation'
);

CREATE TYPE payment_method AS ENUM (
  'pix',
  'card',
  'cash'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'confirmed',
  'cancelled'
);

CREATE TYPE field_type AS ENUM (
  'select',
  'radio',
  'number',
  'text',
  'textarea',
  'checkbox'
);

CREATE TYPE cart_item_type AS ENUM (
  'service',
  'product'
);

-- =============================================
-- 2. TABELAS — CATÁLOGO
-- =============================================

-- CATEGORIES
CREATE TABLE categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  image_url     TEXT,
  parent_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- PRODUCTS (papelaria — preço fixo)
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  image_url       TEXT,
  price           DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_quantity  INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_is_active ON products(is_active) WHERE deleted_at IS NULL;

-- SERVICES (gráfica — preço calculado pelo engine)
CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  image_url     TEXT,
  base_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_slug ON services(slug);
CREATE INDEX idx_services_is_active ON services(is_active) WHERE deleted_at IS NULL;

-- =============================================
-- 3. TABELAS — CAMPOS CONFIGURÁVEIS DE SERVIÇO
-- =============================================

-- SERVICE_FIELDS (tabela separada — não JSONB em services)
-- Cada serviço tem 0..N campos configuráveis pelo admin.
-- O frontend renderiza dinamicamente a partir destes registros.
-- Ref: PROJECT_SPEC Seção 8, SYSTEM-INSTRUCTIONS linha 56-59
CREATE TABLE service_fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  label         TEXT NOT NULL,
  field_type    field_type NOT NULL,
  options       JSONB DEFAULT '[]'::jsonb,
  -- options: [{ "value": "couche", "label": "Couché", "price_effect": { "type": "multiply", "value": 1.5 } }]
  is_required   BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_service_field_key UNIQUE (service_id, key)
);

CREATE INDEX idx_service_fields_service_id ON service_fields(service_id);

-- =============================================
-- 4. TABELAS — PRICING ENGINE
-- =============================================

-- ATTRIBUTE_GROUPS (ex: "Tipo de Papel", "Cor", "Tamanho")
CREATE TABLE attribute_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- ATTRIBUTES (ex: "Sulfite", "Couché", "A4", "Colorido")
CREATE TABLE attributes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID NOT NULL REFERENCES attribute_groups(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_attributes_group_id ON attributes(group_id);

-- PRICING_RULES (uma regra = uma combinação de atributos → preço por página)
-- Ref: SYSTEM-INSTRUCTIONS linha 63 — combinações com suporte a coringa (null)
-- Ref: PROJECT_SPEC Seção 9.3 — fallback_behavior per service
CREATE TABLE pricing_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id          UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  price_per_page      DECIMAL(10,4) NOT NULL,
  fallback_behavior   TEXT NOT NULL DEFAULT 'use_base'
                      CHECK (fallback_behavior IN ('use_base', 'block')),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_rules_service_id ON pricing_rules(service_id);

-- PRICING_RULE_ATTRIBUTES (M:N entre regras e atributos)
-- NULL em attribute_id = coringa para aquele grupo
-- Ref: SYSTEM-INSTRUCTIONS linha 63
CREATE TABLE pricing_rule_attributes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_rule_id   UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE CASCADE,
  attribute_id      UUID REFERENCES attributes(id) ON DELETE CASCADE,
  -- NULL = coringa (match com qualquer atributo desse grupo)

  CONSTRAINT uq_rule_attribute UNIQUE (pricing_rule_id, attribute_id)
);

CREATE INDEX idx_pricing_rule_attrs_rule_id ON pricing_rule_attributes(pricing_rule_id);
CREATE INDEX idx_pricing_rule_attrs_attr_id ON pricing_rule_attributes(attribute_id);

-- PRICING_DISCOUNTS (descontos progressivos por quantidade)
-- Ref: SYSTEM-INSTRUCTIONS linha 66, PROJECT_SPEC Seção 9.4 etapa 5
CREATE TABLE pricing_discounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id        UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  min_quantity      INTEGER NOT NULL,
  max_quantity      INTEGER,
  discount_percent  DECIMAL(5,2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_discounts_service_id ON pricing_discounts(service_id);

-- =============================================
-- 5. TABELAS — USUÁRIOS
-- =============================================

-- PROFILES (estende auth.users para clientes)
-- id = auth.users.id
-- Ref: PROJECT_SPEC Seção 2.2, Seção 15
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ADDRESSES (endereços salvos do cliente)
-- Ref: PROJECT_SPEC Seção 12.1, Seção 15 (/dashboard/dados)
CREATE TABLE addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label         TEXT NOT NULL DEFAULT 'Principal',
  street        TEXT NOT NULL,
  number        TEXT NOT NULL,
  complement    TEXT,
  neighborhood  TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL CHECK (char_length(state) = 2),
  zip_code      TEXT NOT NULL CHECK (char_length(zip_code) = 8),
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- ADMIN_USERS (tabela separada para administradores)
-- id = auth.users.id
-- Ref: SYSTEM-INSTRUCTIONS linha 48-52 — 4 roles
-- Ref: PROJECT_SPEC Seção 2.3 — um admin tem exatamente um role
-- Ref: SYSTEM-INSTRUCTIONS linha 33 — admin somente email+senha
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  role          admin_role NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_users_role ON admin_users(role);
CREATE INDEX idx_admin_users_is_active ON admin_users(is_active);

-- =============================================
-- 6. TABELAS — PEDIDOS
-- =============================================

-- ORDERS
-- Ref: SYSTEM-INSTRUCTIONS linha 39-42
-- Ref: PROJECT_SPEC Seção 4, 12, 13, 17, 19
CREATE TABLE orders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number                TEXT NOT NULL UNIQUE,
  -- Formato: JK-2024-0001 (gerado via sequence ou função)
  user_id                     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- NULL se guest
  guest_email                 TEXT,
  guest_name                  TEXT,
  guest_phone                 TEXT,
  order_token                 UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- Token público para consulta guest (PROJECT_SPEC Seção 5)
  idempotency_key             UUID NOT NULL UNIQUE,
  -- Ref: SYSTEM-INSTRUCTIONS linha 40
  status                      order_status NOT NULL DEFAULT 'new',
  delivery_type               delivery_type NOT NULL DEFAULT 'pickup',
  delivery_address_snapshot   JSONB,
  -- Snapshot do endereço no momento do pedido (imutável)
  delivery_fee                DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal                    DECIMAL(10,2) NOT NULL DEFAULT 0,
  total                       DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method              payment_method NOT NULL,
  payment_status              payment_status NOT NULL DEFAULT 'pending',
  -- Ref: PROJECT_SPEC Seção 13.2
  pix_key_used                TEXT,
  -- Chave Pix no momento do pedido (snapshot)
  whatsapp_message_url        TEXT,
  -- URL completa do deep link gerada no servidor
  whatsapp_sent_at            TIMESTAMPTZ,
  notes                       TEXT,
  anonymized_at               TIMESTAMPTZ,
  -- Ref: PROJECT_SPEC Seção 19.2 — marcado após job de retenção
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_guest_email ON orders(guest_email) WHERE user_id IS NULL;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_order_token ON orders(order_token);
CREATE INDEX idx_orders_idempotency_key ON orders(idempotency_key);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_anonymized_at ON orders(anonymized_at) WHERE anonymized_at IS NULL;

-- ORDER_ITEMS
-- Ref: SYSTEM-INSTRUCTIONS linha 39 — snapshots de preço, nome e config salvos (JSONB)
-- Ref: PROJECT_SPEC Seção 12.3 item 7
CREATE TABLE order_items (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id                    UUID REFERENCES services(id) ON DELETE SET NULL,
  product_id                    UUID REFERENCES products(id) ON DELETE SET NULL,
  -- Um dos dois preenchido (service ou product)
  service_name_snapshot         TEXT,
  service_description_snapshot  TEXT,
  product_name_snapshot         TEXT,
  fields_snapshot               JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Configurações escolhidas pelo cliente congeladas
  quantity                      INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  pages_count                   INTEGER NOT NULL DEFAULT 0,
  pages_method                  page_count_method NOT NULL DEFAULT 'exact',
  is_double_sided               BOOLEAN NOT NULL DEFAULT false,
  unit_price                    DECIMAL(10,4) NOT NULL DEFAULT 0,
  total_price                   DECIMAL(10,2) NOT NULL DEFAULT 0,
  pricing_rule_id               UUID REFERENCES pricing_rules(id) ON DELETE SET NULL,
  pricing_rule_snapshot         JSONB,
  -- Snapshot completo do PricingResult.breakdown (PROJECT_SPEC Seção 9.5)
  discount_applied              DECIMAL(5,2) DEFAULT 0,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_item_reference CHECK (
    (service_id IS NOT NULL AND product_id IS NULL) OR
    (service_id IS NULL AND product_id IS NOT NULL)
  )
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_service_id ON order_items(service_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- ORDER_FILES
-- Ref: SYSTEM-INSTRUCTIONS linha 74-81, PROJECT_SPEC Seção 10
CREATE TABLE order_files (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id       UUID REFERENCES order_items(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- NULL se guest
  original_name       TEXT NOT NULL,
  storage_path        TEXT NOT NULL,
  -- Path interno no Supabase Storage — nunca exposto ao cliente
  mime_type           TEXT NOT NULL,
  file_type           file_type NOT NULL,
  size_bytes          BIGINT NOT NULL DEFAULT 0,
  page_count          INTEGER NOT NULL DEFAULT 0,
  page_count_method   page_count_method NOT NULL DEFAULT 'exact',
  is_suspicious       BOOLEAN NOT NULL DEFAULT false,
  status              file_status NOT NULL DEFAULT 'uploading',
  expires_at          TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_files_order_id ON order_files(order_id);
CREATE INDEX idx_order_files_order_item_id ON order_files(order_item_id);
CREATE INDEX idx_order_files_user_id ON order_files(user_id);
CREATE INDEX idx_order_files_status ON order_files(status) WHERE deleted_at IS NULL;

-- ORDER_EVENTS (auditoria de mudanças de status)
-- Ref: PROJECT_SPEC Seção 17.2 — registrar status_changed_at, status_changed_by
CREATE TABLE order_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_user_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  from_status     order_status,
  to_status       order_status NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_events_order_id ON order_events(order_id);
CREATE INDEX idx_order_events_admin_user_id ON order_events(admin_user_id);

-- FAVORITE_ORDERS (cliente pode favoritar/repetir pedidos)
-- Ref: PROJECT_SPEC Seção 2.2 — pedidos favoritos / repetir pedido
CREATE TABLE favorite_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_favorite_user_order UNIQUE (user_id, order_id)
);

CREATE INDEX idx_favorite_orders_user_id ON favorite_orders(user_id);

-- =============================================
-- 7. TABELAS — CARRINHO
-- =============================================

-- CART_ITEMS (persistência para clientes logados)
-- Ref: PROJECT_SPEC Seção 11 — carrinho persiste no banco para clientes
-- Guest usa cookie (não tem tabela)
CREATE TABLE cart_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type         cart_item_type NOT NULL,
  reference_id      UUID NOT NULL,
  -- service_id ou product_id (conforme item_type)
  selected_options  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Campos preenchidos: { "tipo_papel": "couche", "colorido": true }
  file_ids          UUID[] DEFAULT '{}',
  -- Array de order_files.id (arquivos já enviados)
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  is_double_sided   BOOLEAN NOT NULL DEFAULT false,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);

-- =============================================
-- 8. TABELAS — CONFIGURAÇÕES
-- =============================================

-- SYSTEM_CONFIG (key-value para todas as configurações do negócio)
-- Ref: SYSTEM-INSTRUCTIONS linha 42 — nenhum valor hardcoded
-- Ref: PROJECT_SPEC Seção 21 — 9+ pontos configuráveis
CREATE TABLE system_config (
  key           TEXT PRIMARY KEY,
  value         JSONB NOT NULL,
  description   TEXT,
  updated_by    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AUDIT_LOGS (log de ações administrativas)
-- Ref: PROJECT_SPEC Seção 17.2 — log de auditoria
-- Ref: PROJECT_SPEC Seção 19.3 — log de execução do job de retenção
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  entity          TEXT NOT NULL,
  entity_id       UUID,
  old_value       JSONB,
  new_value       JSONB,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================
-- 9. SEQUENCE — order_number
-- =============================================

CREATE SEQUENCE order_number_seq START WITH 1 INCREMENT BY 1;

-- Função para gerar order_number no formato JK-AAAA-NNNN
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'JK-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();

-- =============================================
-- 10. TRIGGER — updated_at automático
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas as tabelas com updated_at
CREATE TRIGGER trg_updated_at_categories BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_products BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_services BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_pricing_rules BEFORE UPDATE ON pricing_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_addresses BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_admin_users BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_order_files BEFORE UPDATE ON order_files FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_cart_items BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 11. RLS — HABILITAR EM TODAS AS TABELAS
-- =============================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rule_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 12. RLS POLICIES — CATÁLOGO PÚBLICO (leitura anônima)
-- =============================================

-- Qualquer pessoa (incluindo anon) pode ler catálogo ativo
CREATE POLICY "Public: read active categories"
  ON categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public: read active products"
  ON products FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "Public: read active services"
  ON services FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "Public: read active service_fields"
  ON service_fields FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_fields.service_id
      AND s.is_active = true AND s.deleted_at IS NULL
    )
  );

CREATE POLICY "Public: read active attribute_groups"
  ON attribute_groups FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public: read active attributes"
  ON attributes FOR SELECT
  USING (is_active = true);

-- Pricing rules: leitura pública necessária para o PricingEngine
-- (chamado via Server Action, mas o query roda com o JWT do usuário)
CREATE POLICY "Public: read active pricing_rules"
  ON pricing_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public: read pricing_rule_attributes"
  ON pricing_rule_attributes FOR SELECT
  USING (true);

CREATE POLICY "Public: read active pricing_discounts"
  ON pricing_discounts FOR SELECT
  USING (is_active = true);

-- =============================================
-- 13. RLS POLICIES — CLIENTE AUTENTICADO
-- =============================================

-- Profiles: cliente vê/edita apenas seu próprio perfil
CREATE POLICY "Client: read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Client: update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Client: insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Addresses: cliente vê/edita apenas seus endereços
CREATE POLICY "Client: read own addresses"
  ON addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Client: insert own addresses"
  ON addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Client: update own addresses"
  ON addresses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Client: delete own addresses"
  ON addresses FOR DELETE
  USING (auth.uid() = user_id);

-- Orders: cliente vê apenas seus pedidos
CREATE POLICY "Client: read own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

-- Order Items: cliente vê itens dos seus pedidos
CREATE POLICY "Client: read own order_items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
    )
  );

-- Order Files: cliente vê/cria seus arquivos
CREATE POLICY "Client: read own order_files"
  ON order_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Client: insert own order_files"
  ON order_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Order Events: cliente vê eventos dos seus pedidos
CREATE POLICY "Client: read own order_events"
  ON order_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_events.order_id
      AND o.user_id = auth.uid()
    )
  );

-- Favorite Orders: cliente gerencia seus favoritos
CREATE POLICY "Client: read own favorites"
  ON favorite_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Client: insert own favorites"
  ON favorite_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Client: delete own favorites"
  ON favorite_orders FOR DELETE
  USING (auth.uid() = user_id);

-- Cart Items: cliente gerencia seu carrinho
CREATE POLICY "Client: read own cart"
  ON cart_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Client: insert own cart"
  ON cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Client: update own cart"
  ON cart_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Client: delete own cart"
  ON cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 14. RLS POLICIES — ADMIN
-- =============================================

-- Função auxiliar: verifica se o user é admin ativo
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar: retorna o role do admin
CREATE OR REPLACE FUNCTION get_admin_role()
RETURNS admin_role AS $$
BEGIN
  RETURN (
    SELECT role FROM admin_users
    WHERE id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar: verifica se é super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND role = 'super_admin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CATÁLOGO: admin com role catalogo, admin ou super_admin pode escrever
CREATE POLICY "Admin: full access categories"
  ON categories FOR ALL
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'catalogo'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'catalogo'));

CREATE POLICY "Admin: full access products"
  ON products FOR ALL
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'catalogo'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'catalogo'));

CREATE POLICY "Admin: full access services"
  ON services FOR ALL
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'catalogo'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'catalogo'));

CREATE POLICY "Admin: full access service_fields"
  ON service_fields FOR ALL
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'catalogo'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'catalogo'));

-- PRICING: super_admin e admin podem escrever
CREATE POLICY "Admin: full access attribute_groups"
  ON attribute_groups FOR ALL
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin'));

CREATE POLICY "Admin: full access attributes"
  ON attributes FOR ALL
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin'));

CREATE POLICY "Admin: full access pricing_rules"
  ON pricing_rules FOR ALL
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin'));

CREATE POLICY "Admin: full access pricing_rule_attributes"
  ON pricing_rule_attributes FOR ALL
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin'));

CREATE POLICY "Admin: full access pricing_discounts"
  ON pricing_discounts FOR ALL
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin'));

-- PEDIDOS: super_admin, admin e producao podem ler/atualizar
CREATE POLICY "Admin: read all orders"
  ON orders FOR SELECT
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'producao'));

CREATE POLICY "Admin: update orders"
  ON orders FOR UPDATE
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'producao'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'producao'));

CREATE POLICY "Admin: read all order_items"
  ON order_items FOR SELECT
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'producao'));

CREATE POLICY "Admin: read all order_files"
  ON order_files FOR SELECT
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'producao'));

CREATE POLICY "Admin: update order_files"
  ON order_files FOR UPDATE
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'producao'))
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'producao'));

CREATE POLICY "Admin: read all order_events"
  ON order_events FOR SELECT
  USING (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'producao'));

CREATE POLICY "Admin: insert order_events"
  ON order_events FOR INSERT
  WITH CHECK (is_admin() AND get_admin_role() IN ('super_admin', 'admin', 'producao'));

-- ADMIN_USERS: somente super_admin gerencia
CREATE POLICY "Admin: super_admin read admin_users"
  ON admin_users FOR SELECT
  USING (is_admin());
  -- Todos os admins podem ler (para ver seu próprio perfil)

CREATE POLICY "Admin: super_admin manage admin_users"
  ON admin_users FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- SYSTEM_CONFIG: leitura para admin/super_admin, escrita para super_admin
CREATE POLICY "Admin: read system_config"
  ON system_config FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin: write system_config"
  ON system_config FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Configurações operacionais: admin também pode escrever
-- (delivery_fee, whatsapp_number, pix_key, etc.)
-- Implementado via Server Action que verifica role antes de chamar service_role

-- AUDIT_LOGS: somente super_admin lê, inserção via service_role
CREATE POLICY "Admin: super_admin read audit_logs"
  ON audit_logs FOR SELECT
  USING (is_super_admin());

-- =============================================
-- 15. RLS POLICIES — GUEST (via order_token)
-- =============================================

-- Guest consulta pedido via order_token + email
-- Ref: SYSTEM-INSTRUCTIONS linha 46, PROJECT_SPEC Seção 5
-- Implementado via Server Action com service_role
-- (guest não tem JWT, então as policies de anon cobrem catálogo)
-- A consulta de pedido do guest é feita via Server Action que:
--   1. Recebe token + email
--   2. Usa service_role para buscar pedido
--   3. Valida email === guest_email
--   4. Retorna dados

-- =============================================
-- 16. STORAGE BUCKETS
-- =============================================

-- Bucket: order-files (PRIVADO)
-- Ref: PROJECT_SPEC Seção 10.2 item 5 — bucket privado
-- Ref: PROJECT_SPEC Seção 20.4 — URL assinada com expiração
INSERT INTO storage.buckets (id, name, public) VALUES ('order-files', 'order-files', false);

-- Bucket: public-assets (PÚBLICO)
-- Para: logos, imagens de categoria, imagens de serviço/produto
INSERT INTO storage.buckets (id, name, public) VALUES ('public-assets', 'public-assets', true);

-- Storage Policies: order-files
-- Upload: clientes autenticados podem enviar para seu path
CREATE POLICY "Storage: client upload order-files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Download: clientes leem apenas seus arquivos
CREATE POLICY "Storage: client read own order-files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'order-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Admin: producao, admin e super_admin podem ler todos os arquivos
CREATE POLICY "Storage: admin read all order-files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'order-files'
    AND is_admin()
    AND get_admin_role() IN ('super_admin', 'admin', 'producao')
  );

-- Storage Policies: public-assets
-- Leitura pública
CREATE POLICY "Storage: public read public-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-assets');

-- Upload: apenas admin catalogo, admin e super_admin
CREATE POLICY "Storage: admin upload public-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'public-assets'
    AND is_admin()
    AND get_admin_role() IN ('super_admin', 'admin', 'catalogo')
  );

CREATE POLICY "Storage: admin delete public-assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'public-assets'
    AND is_admin()
    AND get_admin_role() IN ('super_admin', 'admin', 'catalogo')
  );

-- =============================================
-- 17. SEED — system_config DEFAULTS
-- =============================================

-- Ref: PROJECT_SPEC Seção 21 — valores padrão sugeridos
INSERT INTO system_config (key, value, description) VALUES
  ('store_name',              '"JK Copycenter"',                            'Nome da loja'),
  ('store_address',           '""',                                         'Endereço da loja'),
  ('whatsapp_number',         '""',                                         'Número WhatsApp (formato: 55DDDNUMERO)'),
  ('pix_key',                 '{"type": "", "key": "", "owner_name": ""}',  'Chave Pix para pagamentos'),
  ('delivery_fee',            '0',                                          'Taxa de entrega em R$'),
  ('delivery_city',           '""',                                         'Cidade de entrega'),
  ('upload_max_size_bytes',   '52428800',                                   'Tamanho máximo por arquivo em bytes (50MB)'),
  ('upload_max_files_per_order', '10',                                      'Quantidade máxima de arquivos por pedido'),
  ('pricing_rounding_rule',   '"round"',                                    'Regra de arredondamento: round | ceil | floor | none'),
  ('stock_management_mode',   '"none"',                                     'Modo de gestão de estoque: none | reserve_on_checkout | deduct_on_archive'),
  ('cart_cookie_expiry_days',  '7',                                         'Expiração do cookie do carrinho guest em dias'),
  ('data_retention_days',      '30',                                        'Período de retenção de dados pessoais em dias'),
  ('zip_max_compression_ratio', '100',                                      'Ratio máximo comprimido:descomprimido para ZIP/RAR'),
  ('signed_url_expiry_seconds', '3600',                                     'Expiração de URL assinada em segundos'),
  ('cart_max_quantity_per_item', '9999',                                     'Quantidade máxima por item no carrinho'),
  ('double_sided_multiplier',   '1.0',                                      'Multiplicador de preço para frente/verso');

-- =============================================
-- 18. TRIGGER — Criar profile ao registrar
-- =============================================

-- Ao criar um usuário no auth.users, cria automaticamente o profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
