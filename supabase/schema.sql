-- =====================================================
-- TorqueTools ERP/CRM - Complete Database Schema
-- Prefix: tt_ (to avoid conflicts with other projects)
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- COMPANIES
-- =====================================================
CREATE TABLE tt_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,               -- CIF/CUIT/EIN
  country TEXT NOT NULL,     -- ES, AR, US
  currency TEXT NOT NULL DEFAULT 'EUR',  -- EUR, ARS, USD
  address TEXT,
  city TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  iban TEXT,
  swift TEXT,
  default_tax_rate NUMERIC(5,2) DEFAULT 21.00,
  default_margin NUMERIC(5,2) DEFAULT 30.00,
  invoice_prefix TEXT,
  invoice_next_number INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- USERS (extends Supabase auth.users)
-- =====================================================
CREATE TABLE tt_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE,      -- Links to auth.users
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  short_name TEXT,
  role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor', 'viewer')),
  phone TEXT,
  whatsapp TEXT,
  avatar_url TEXT,
  default_company_id UUID REFERENCES tt_companies(id),
  permissions JSONB DEFAULT '{}',
  gmail_connected BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PRODUCT CATEGORIES
-- =====================================================
CREATE TABLE tt_product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES tt_product_categories(id),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PRODUCTS
-- =====================================================
CREATE TABLE tt_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT NOT NULL,
  category_id UUID REFERENCES tt_product_categories(id),
  category_name TEXT,        -- denormalized for quick display
  price_cost NUMERIC(12,2) DEFAULT 0,
  price_list NUMERIC(12,2) DEFAULT 0,
  price_currency TEXT DEFAULT 'EUR',
  weight_kg NUMERIC(8,3),
  hs_code TEXT,              -- Harmonized System code
  origin_country TEXT,
  image_url TEXT,
  specs JSONB DEFAULT '{}',  -- Flexible specs: {"voltage": "230V", "power": "1200W"}
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  search_tokens TEXT,        -- Pre-computed search field
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_products_sku ON tt_products(sku);
CREATE INDEX idx_tt_products_brand ON tt_products(brand);
CREATE INDEX idx_tt_products_search ON tt_products USING gin(search_tokens gin_trgm_ops);
CREATE INDEX idx_tt_products_category ON tt_products(category_id);

-- =====================================================
-- CLIENTS
-- =====================================================
CREATE TABLE tt_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT,                 -- Client code (C-0001)
  company_name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,               -- CIF/CUIT/EIN
  type TEXT DEFAULT 'empresa' CHECK (type IN ('empresa', 'autonomo', 'particular', 'distribuidor')),
  country TEXT DEFAULT 'ES',
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  payment_terms TEXT DEFAULT '30 dias',
  credit_limit NUMERIC(12,2) DEFAULT 0,
  discount_default NUMERIC(5,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  assigned_to UUID REFERENCES tt_users(id),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  total_revenue NUMERIC(14,2) DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_clients_code ON tt_clients(code);
CREATE INDEX idx_tt_clients_company ON tt_clients USING gin(company_name gin_trgm_ops);

-- =====================================================
-- CLIENT CONTACTS
-- =====================================================
CREATE TABLE tt_client_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES tt_clients(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  position TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_client_contacts_client ON tt_client_contacts(client_id);

-- =====================================================
-- WAREHOUSES
-- =====================================================
CREATE TABLE tt_warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'ES',
  company_id UUID REFERENCES tt_companies(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- STOCK
-- =====================================================
CREATE TABLE tt_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES tt_products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES tt_warehouses(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  last_counted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, warehouse_id)
);

CREATE INDEX idx_tt_stock_product ON tt_stock(product_id);
CREATE INDEX idx_tt_stock_warehouse ON tt_stock(warehouse_id);

-- =====================================================
-- QUOTES (Cotizaciones / Presupuestos)
-- =====================================================
CREATE TABLE tt_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES tt_companies(id),
  client_id UUID REFERENCES tt_clients(id),
  client_contact_id UUID REFERENCES tt_client_contacts(id),
  created_by UUID NOT NULL REFERENCES tt_users(id),
  status TEXT DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviada', 'aceptada', 'rechazada', 'expirada', 'facturada')),
  title TEXT,
  notes TEXT,
  internal_notes TEXT,
  incoterm TEXT,
  payment_terms TEXT,
  validity_days INTEGER DEFAULT 30,
  currency TEXT DEFAULT 'EUR',
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  subtotal NUMERIC(14,2) DEFAULT 0,
  discount_total NUMERIC(14,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 21.00,
  tax_amount NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2) DEFAULT 0,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_quotes_company ON tt_quotes(company_id);
CREATE INDEX idx_tt_quotes_client ON tt_quotes(client_id);
CREATE INDEX idx_tt_quotes_status ON tt_quotes(status);

-- =====================================================
-- QUOTE ITEMS
-- =====================================================
CREATE TABLE tt_quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES tt_quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES tt_products(id),
  sort_order INTEGER DEFAULT 0,
  sku TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_quote_items_quote ON tt_quote_items(quote_id);

-- =====================================================
-- CRM OPPORTUNITIES
-- =====================================================
CREATE TABLE tt_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  client_id UUID REFERENCES tt_clients(id),
  company_id UUID REFERENCES tt_companies(id),
  assigned_to UUID REFERENCES tt_users(id),
  stage TEXT DEFAULT 'lead' CHECK (stage IN ('lead', 'propuesta', 'negociacion', 'ganado', 'perdido')),
  value NUMERIC(14,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  probability INTEGER DEFAULT 10 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  source TEXT,
  lost_reason TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  quote_id UUID REFERENCES tt_quotes(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_opportunities_stage ON tt_opportunities(stage);
CREATE INDEX idx_tt_opportunities_client ON tt_opportunities(client_id);

-- =====================================================
-- PURCHASE ORDERS
-- =====================================================
CREATE TABLE tt_purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES tt_companies(id),
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  supplier_email TEXT,
  status TEXT DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviada', 'confirmada', 'recibida_parcial', 'recibida', 'cancelada')),
  currency TEXT DEFAULT 'EUR',
  subtotal NUMERIC(14,2) DEFAULT 0,
  tax_amount NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  expected_delivery DATE,
  created_by UUID REFERENCES tt_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PO ITEMS
-- =====================================================
CREATE TABLE tt_po_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES tt_purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES tt_products(id),
  sku TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  received_quantity NUMERIC(10,2) DEFAULT 0,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- SALES ORDERS
-- =====================================================
CREATE TABLE tt_sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_number TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES tt_companies(id),
  client_id UUID REFERENCES tt_clients(id),
  quote_id UUID REFERENCES tt_quotes(id),
  status TEXT DEFAULT 'borrador' CHECK (status IN ('borrador', 'confirmado', 'en_preparacion', 'enviado', 'entregado', 'facturado', 'cancelado')),
  currency TEXT DEFAULT 'EUR',
  subtotal NUMERIC(14,2) DEFAULT 0,
  tax_amount NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2) DEFAULT 0,
  shipping_address TEXT,
  tracking_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES tt_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- SO ITEMS
-- =====================================================
CREATE TABLE tt_so_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id UUID NOT NULL REFERENCES tt_sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES tt_products(id),
  sku TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  shipped_quantity NUMERIC(10,2) DEFAULT 0,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- SAT TICKETS (Service / Maintenance)
-- =====================================================
CREATE TABLE tt_sat_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT NOT NULL UNIQUE,
  client_id UUID REFERENCES tt_clients(id),
  company_id UUID REFERENCES tt_companies(id),
  assigned_to UUID REFERENCES tt_users(id),
  product_id UUID REFERENCES tt_products(id),
  serial_number TEXT,
  type TEXT DEFAULT 'reparacion' CHECK (type IN ('reparacion', 'mantenimiento', 'garantia', 'instalacion', 'calibracion')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('baja', 'normal', 'alta', 'urgente')),
  status TEXT DEFAULT 'abierto' CHECK (status IN ('abierto', 'en_proceso', 'esperando_repuesto', 'resuelto', 'cerrado')),
  title TEXT NOT NULL,
  description TEXT,
  resolution TEXT,
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  cost NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- =====================================================
-- ACTIVITY LOG (Audit Trail)
-- =====================================================
CREATE TABLE tt_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES tt_users(id),
  entity_type TEXT NOT NULL,   -- 'quote', 'client', 'product', etc.
  entity_id UUID,
  action TEXT NOT NULL,        -- 'create', 'update', 'delete', 'send', etc.
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_activity_log_entity ON tt_activity_log(entity_type, entity_id);
CREATE INDEX idx_tt_activity_log_user ON tt_activity_log(user_id);
CREATE INDEX idx_tt_activity_log_date ON tt_activity_log(created_at DESC);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE tt_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES tt_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_notifications_user ON tt_notifications(user_id, is_read);

-- =====================================================
-- MAIL FOLLOW-UPS
-- =====================================================
CREATE TABLE tt_mail_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES tt_users(id),
  client_id UUID REFERENCES tt_clients(id),
  subject TEXT NOT NULL,
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'seguimiento', 'respondido', 'archivado')),
  follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- SYSTEM PARAMS (Key-Value Config)
-- =====================================================
CREATE TABLE tt_system_params (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE tt_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_so_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_sat_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_mail_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_system_params ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES (Allow authenticated users full access for now)
-- =====================================================
CREATE POLICY "Authenticated users can read all" ON tt_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage" ON tt_companies FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can read all" ON tt_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage" ON tt_users FOR ALL TO authenticated USING (true);

CREATE POLICY "Products readable" ON tt_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Products manageable" ON tt_products FOR ALL TO authenticated USING (true);

CREATE POLICY "Categories readable" ON tt_product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Categories manageable" ON tt_product_categories FOR ALL TO authenticated USING (true);

CREATE POLICY "Clients readable" ON tt_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clients manageable" ON tt_clients FOR ALL TO authenticated USING (true);

CREATE POLICY "Contacts readable" ON tt_client_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Contacts manageable" ON tt_client_contacts FOR ALL TO authenticated USING (true);

CREATE POLICY "Warehouses readable" ON tt_warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Warehouses manageable" ON tt_warehouses FOR ALL TO authenticated USING (true);

CREATE POLICY "Stock readable" ON tt_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stock manageable" ON tt_stock FOR ALL TO authenticated USING (true);

CREATE POLICY "Quotes readable" ON tt_quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Quotes manageable" ON tt_quotes FOR ALL TO authenticated USING (true);

CREATE POLICY "Quote items readable" ON tt_quote_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Quote items manageable" ON tt_quote_items FOR ALL TO authenticated USING (true);

CREATE POLICY "Opportunities readable" ON tt_opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Opportunities manageable" ON tt_opportunities FOR ALL TO authenticated USING (true);

CREATE POLICY "PO readable" ON tt_purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "PO manageable" ON tt_purchase_orders FOR ALL TO authenticated USING (true);

CREATE POLICY "PO items readable" ON tt_po_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "PO items manageable" ON tt_po_items FOR ALL TO authenticated USING (true);

CREATE POLICY "SO readable" ON tt_sales_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "SO manageable" ON tt_sales_orders FOR ALL TO authenticated USING (true);

CREATE POLICY "SO items readable" ON tt_so_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "SO items manageable" ON tt_so_items FOR ALL TO authenticated USING (true);

CREATE POLICY "SAT readable" ON tt_sat_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "SAT manageable" ON tt_sat_tickets FOR ALL TO authenticated USING (true);

CREATE POLICY "Activity readable" ON tt_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Activity manageable" ON tt_activity_log FOR ALL TO authenticated USING (true);

CREATE POLICY "Notifications for user" ON tt_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Notifications manageable" ON tt_notifications FOR ALL TO authenticated USING (true);

CREATE POLICY "Followups readable" ON tt_mail_followups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Followups manageable" ON tt_mail_followups FOR ALL TO authenticated USING (true);

CREATE POLICY "Params readable" ON tt_system_params FOR SELECT TO authenticated USING (true);
CREATE POLICY "Params manageable" ON tt_system_params FOR ALL TO authenticated USING (true);

-- =====================================================
-- SEED DATA: COMPANIES
-- =====================================================
INSERT INTO tt_companies (name, legal_name, tax_id, country, currency, address, city, postal_code, phone, email, website, default_tax_rate, default_margin, invoice_prefix) VALUES
('TorqueTools SL', 'TorqueTools SL', 'B12345678', 'ES', 'EUR', 'Calle Industrial 15', 'Barcelona', '08001', '+34 93 123 4567', 'info@torquetools.es', 'https://torquetools.es', 21.00, 30.00, 'TT'),
('BuscaTools SA', 'BuscaTools SA', '30-71234567-8', 'AR', 'ARS', 'Av. Corrientes 1234', 'Buenos Aires', 'C1043', '+54 11 4567-8901', 'info@buscatools.com.ar', 'https://buscatools.com.ar', 21.00, 35.00, 'BT'),
('Torquear SA', 'Torquear SA', '30-71234568-9', 'AR', 'ARS', 'Av. Libertador 5678', 'Buenos Aires', 'C1001', '+54 11 4567-8902', 'info@torquear.com.ar', 'https://torquear.com.ar', 21.00, 35.00, 'TQ'),
('Global Assembly Solutions LLC', 'Global Assembly Solutions LLC', '12-3456789', 'US', 'USD', '123 Industrial Ave', 'Houston', '77001', '+1 713 555 0100', 'info@gasolutions.com', 'https://gasolutions.com', 0.00, 25.00, 'GAS');

-- =====================================================
-- SEED DATA: USERS
-- =====================================================
INSERT INTO tt_users (email, full_name, short_name, role, phone) VALUES
('jmocciaro@gmail.com', 'Juan Manuel Mocciaro', 'Juan', 'admin', '+34 600 123 456'),
('facu@torquetools.es', 'Facundo', 'Facu', 'vendedor', '+34 600 234 567'),
('norber@torquetools.es', 'Norberto', 'Norber', 'vendedor', '+34 600 345 678'),
('jano@torquetools.es', 'Jano', 'Jano', 'vendedor', '+34 600 456 789');

-- =====================================================
-- SEED DATA: WAREHOUSES
-- =====================================================
INSERT INTO tt_warehouses (name, code, city, country) VALUES
('Almacen Barcelona', 'BCN', 'Barcelona', 'ES'),
('Almacen Buenos Aires', 'BUE', 'Buenos Aires', 'AR'),
('Almacen Houston', 'HOU', 'Houston', 'US');

-- =====================================================
-- SEED DATA: PRODUCT CATEGORIES
-- =====================================================
INSERT INTO tt_product_categories (name, slug, sort_order) VALUES
('Herramientas Eléctricas', 'herramientas-electricas', 1),
('Herramientas Neumáticas', 'herramientas-neumaticas', 2),
('Torquímetros', 'torquimetros', 3),
('Soldadura por Puntos', 'soldadura-puntos', 4),
('Taladros', 'taladros', 5),
('Atornilladores', 'atornilladores', 6),
('Amoladoras', 'amoladoras', 7),
('Accesorios', 'accesorios', 8),
('Repuestos', 'repuestos', 9);

-- =====================================================
-- SEED DATA: SYSTEM PARAMS
-- =====================================================
INSERT INTO tt_system_params (key, value, description) VALUES
('default_currency', 'EUR', 'Moneda por defecto del sistema'),
('quote_validity_days', '30', 'Días de validez por defecto de cotizaciones'),
('default_tax_rate', '21', 'Tasa de IVA por defecto (%)'),
('app_name', 'TorqueTools ERP', 'Nombre de la aplicación'),
('app_version', '1.0.0', 'Versión del sistema');

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION tt_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_companies FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_users FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_products FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_clients FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_stock FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_quotes FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_opportunities FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_purchase_orders FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_sales_orders FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_sat_tickets FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tt_mail_followups FOR EACH ROW EXECUTE FUNCTION tt_update_updated_at();
