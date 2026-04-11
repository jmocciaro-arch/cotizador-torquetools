-- =====================================================
-- TorqueTools ERP - Migration V2: Document Flow System
-- =====================================================

-- Drop old document tables if they conflict
DROP TABLE IF EXISTS tt_document_item_components CASCADE;
DROP TABLE IF EXISTS tt_document_links CASCADE;
DROP TABLE IF EXISTS tt_document_items CASCADE;
DROP TABLE IF EXISTS tt_oc_parsed CASCADE;
DROP TABLE IF EXISTS tt_alerts CASCADE;
DROP TABLE IF EXISTS tt_stock_movements CASCADE;
DROP TABLE IF EXISTS tt_delivery_doc_names CASCADE;
DROP TABLE IF EXISTS tt_documents CASCADE;

-- 1. DOCUMENTS (master table for all commercial documents)
CREATE TABLE tt_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  subtype TEXT DEFAULT 'standard',
  flow_role TEXT,
  localized_label TEXT,
  system_code TEXT UNIQUE NOT NULL,
  display_ref TEXT,
  legal_number TEXT,
  company_id UUID REFERENCES tt_companies(id),
  client_id UUID REFERENCES tt_clients(id),
  user_id UUID REFERENCES tt_users(id),
  assigned_to UUID REFERENCES tt_users(id),
  status TEXT NOT NULL DEFAULT 'draft',
  billing_mode TEXT DEFAULT 'standard',
  currency TEXT DEFAULT 'EUR',
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 21,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  incoterm TEXT,
  payment_terms TEXT,
  delivery_address TEXT,
  delivery_date DATE,
  valid_until DATE,
  notes TEXT,
  internal_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tt_docs_type ON tt_documents(type);
CREATE INDEX idx_tt_docs_status ON tt_documents(status);
CREATE INDEX idx_tt_docs_company ON tt_documents(company_id);
CREATE INDEX idx_tt_docs_client ON tt_documents(client_id);

-- 2. DOCUMENT ITEMS
CREATE TABLE tt_document_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES tt_documents(id) ON DELETE CASCADE,
  product_id UUID REFERENCES tt_products(id),
  oc_line_ref TEXT,
  sku TEXT,
  description TEXT,
  internal_description TEXT,
  quantity NUMERIC(10,2) DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  cost_snapshot NUMERIC(12,2),
  discount_pct NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  qty_reserved NUMERIC(10,2) DEFAULT 0,
  qty_delivered NUMERIC(10,2) DEFAULT 0,
  qty_invoiced NUMERIC(10,2) DEFAULT 0,
  qty_received NUMERIC(10,2) DEFAULT 0,
  qty_cancelled NUMERIC(10,2) DEFAULT 0,
  requires_po BOOLEAN DEFAULT false,
  po_status TEXT,
  po_document_id UUID REFERENCES tt_documents(id),
  warehouse_id UUID REFERENCES tt_warehouses(id),
  stock_at_creation INTEGER,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tt_ditems_doc ON tt_document_items(document_id);

-- 3. DOCUMENT ITEM COMPONENTS (internal breakdown)
CREATE TABLE tt_document_item_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_item_id UUID REFERENCES tt_document_items(id) ON DELETE CASCADE,
  product_id UUID REFERENCES tt_products(id),
  sku TEXT,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  source_oc_line_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. DOCUMENT LINKS (relationships between documents)
CREATE TABLE tt_document_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES tt_documents(id) ON DELETE CASCADE,
  child_id UUID REFERENCES tt_documents(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  item_mapping JSONB,
  fulfillment_pct NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_id, child_id, relation_type)
);

-- 5. OC PARSED (client PO processed by AI)
CREATE TABLE tt_oc_parsed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES tt_documents(id) ON DELETE CASCADE,
  file_url TEXT,
  file_name TEXT,
  parsed_at TIMESTAMPTZ,
  parsed_by TEXT DEFAULT 'manual',
  raw_text TEXT,
  parsed_items JSONB,
  confidence_score NUMERIC(3,2),
  status TEXT DEFAULT 'pending',
  validated_by UUID REFERENCES tt_users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. STOCK MOVEMENTS
CREATE TABLE tt_stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES tt_products(id),
  warehouse_id UUID REFERENCES tt_warehouses(id),
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  document_id UUID REFERENCES tt_documents(id),
  document_item_id UUID REFERENCES tt_document_items(id),
  reference TEXT,
  origin_warehouse_id UUID REFERENCES tt_warehouses(id),
  destination_warehouse_id UUID REFERENCES tt_warehouses(id),
  expected_arrival DATE,
  notes TEXT,
  user_id UUID REFERENCES tt_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tt_smov_product ON tt_stock_movements(product_id);

-- 7. ALERTS
CREATE TABLE tt_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  document_id UUID REFERENCES tt_documents(id),
  document_item_id UUID REFERENCES tt_document_items(id),
  product_id UUID REFERENCES tt_products(id),
  client_id UUID REFERENCES tt_clients(id),
  assigned_to UUID REFERENCES tt_users(id),
  created_by UUID REFERENCES tt_users(id),
  status TEXT DEFAULT 'active',
  snooze_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  due_date DATE,
  auto_generated BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tt_alerts_status ON tt_alerts(status);

-- 8. DELIVERY DOC NAMES BY COUNTRY
CREATE TABLE tt_delivery_doc_names (
  country_code TEXT PRIMARY KEY,
  delivery_label TEXT NOT NULL,
  reception_label TEXT NOT NULL,
  invoice_label TEXT NOT NULL
);
INSERT INTO tt_delivery_doc_names VALUES
  ('AR', 'Remito', 'Recepcion', 'Factura'),
  ('ES', 'Albaran', 'Albaran de compra', 'Factura'),
  ('US', 'Delivery Note', 'Goods Receipt', 'Invoice'),
  ('CL', 'Guia de despacho', 'Recepcion', 'Factura'),
  ('UY', 'Remito', 'Recepcion', 'Factura'),
  ('BR', 'Nota fiscal de remessa', 'Recebimento', 'Nota fiscal'),
  ('MX', 'Nota de remision', 'Recepcion', 'Factura'),
  ('PT', 'Guia de remessa', 'Recesao', 'Fatura');
