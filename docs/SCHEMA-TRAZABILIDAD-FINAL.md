# Schema de Trazabilidad Documental — VERSIÓN FINAL

Incorpora todas las correcciones (10 puntos originales + 3 adicionales: remitos parciales, stock en tránsito, alertas).

---

## 1. Tabla: `tt_documents`

```sql
CREATE TABLE tt_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tipo y rol
  type TEXT NOT NULL,              -- request, client_oc, quote, sales_order, purchase_order, reception, delivery_note, invoice, payment
  subtype TEXT DEFAULT 'standard', -- standard, advance_partial, advance_full, credit_note, debit_note, return, partial
  flow_role TEXT,                  -- advance, balance, correction, complement
  localized_label TEXT,            -- "Remito", "Albarán", "Delivery Note" (según país)
  
  -- Identificadores (3 niveles)
  system_code TEXT UNIQUE NOT NULL,  -- Correlativo interno INMUTABLE: COTI-2026-00001
  display_ref TEXT,                  -- Referencia visible/editable por el usuario
  legal_number TEXT,                 -- Número fiscal (factura AFIP, SII, etc.)
  
  -- Relaciones
  company_id UUID REFERENCES tt_companies(id),
  client_id UUID REFERENCES tt_clients(id),
  user_id UUID REFERENCES tt_users(id),
  assigned_to UUID REFERENCES tt_users(id),
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft | pending_validation | validated | sent | accepted
  -- partially_fulfilled | fulfilled
  -- partially_invoiced | invoiced
  -- partially_collected | collected
  -- closed | cancelled
  
  -- Facturación
  billing_mode TEXT DEFAULT 'standard', -- standard, advance_partial, advance_full, mixed
  currency TEXT DEFAULT 'EUR',
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 21,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  
  -- Comercial
  incoterm TEXT,
  payment_terms TEXT,
  delivery_address TEXT,
  delivery_date DATE,
  valid_until DATE,
  
  -- Notas
  notes TEXT,
  internal_notes TEXT,
  
  -- Metadata flexible
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_docs_type ON tt_documents(type);
CREATE INDEX idx_tt_docs_status ON tt_documents(status);
CREATE INDEX idx_tt_docs_company ON tt_documents(company_id);
CREATE INDEX idx_tt_docs_client ON tt_documents(client_id);
CREATE INDEX idx_tt_docs_code ON tt_documents(system_code);
```

---

## 2. Tabla: `tt_document_items`

```sql
CREATE TABLE tt_document_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES tt_documents(id) ON DELETE CASCADE,
  
  -- Producto
  product_id UUID REFERENCES tt_products(id),
  oc_line_ref TEXT,                  -- Referencia al item de la OC del cliente
  sku TEXT,
  description TEXT,                  -- Lo que ve el cliente
  internal_description TEXT,         -- Descripción interna detallada
  
  -- Cantidades
  quantity NUMERIC(10,2) DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  cost_snapshot NUMERIC(12,2),       -- Se congela al facturar
  discount_pct NUMERIC(5,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  
  -- Trazabilidad de cantidades acumuladas
  qty_reserved NUMERIC(10,2) DEFAULT 0,   -- Reservado en almacén
  qty_delivered NUMERIC(10,2) DEFAULT 0,  -- Entregado al cliente
  qty_invoiced NUMERIC(10,2) DEFAULT 0,   -- Facturado
  qty_received NUMERIC(10,2) DEFAULT 0,   -- Recibido del proveedor
  qty_cancelled NUMERIC(10,2) DEFAULT 0,  -- Cancelado
  
  -- Compras
  requires_po BOOLEAN DEFAULT false,
  po_status TEXT,                    -- null, pending, ordered, in_transit, partial_received, received
  po_document_id UUID REFERENCES tt_documents(id), -- Link al pedido de compra
  
  -- Stock
  warehouse_id UUID REFERENCES tt_warehouses(id),  -- De qué almacén sale
  stock_at_creation INTEGER,         -- Stock disponible al momento de crear el documento
  
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_ditems_doc ON tt_document_items(document_id);
CREATE INDEX idx_tt_ditems_product ON tt_document_items(product_id);
```

---

## 3. Tabla: `tt_document_item_components` (desglose interno)

Para el caso: OC dice "Ferretería" → internamente son 5 productos.

```sql
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

CREATE INDEX idx_tt_dic_parent ON tt_document_item_components(parent_item_id);
```

---

## 4. Tabla: `tt_document_links` (relaciones entre documentos)

```sql
CREATE TABLE tt_document_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES tt_documents(id) ON DELETE CASCADE,
  child_id UUID REFERENCES tt_documents(id) ON DELETE CASCADE,
  
  relation_type TEXT NOT NULL,
  -- generated_from: hijo generado desde padre
  -- validated_against: cotización validada contra OC
  -- fulfills: remito cumple pedido (parcial o total)
  -- invoices: factura cubre remito(s)
  -- collects: cobro asociado a factura
  -- covers: anticipo cubre parte del pedido
  -- requests_purchase: pedido venta genera compra
  -- receives: recepción de pedido a proveedor
  
  item_mapping JSONB,
  -- [{parent_item_id, child_item_id, qty_mapped}]
  -- Permite trazabilidad por línea en entregas parciales
  
  fulfillment_pct NUMERIC(5,2),  -- % cumplido (ej: remito cubre 60% del pedido)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(parent_id, child_id, relation_type)
);

CREATE INDEX idx_tt_dlinks_parent ON tt_document_links(parent_id);
CREATE INDEX idx_tt_dlinks_child ON tt_document_links(child_id);
```

---

## 5. Tabla: `tt_oc_parsed` (OC del cliente procesada por IA)

```sql
CREATE TABLE tt_oc_parsed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES tt_documents(id) ON DELETE CASCADE,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Parseo IA
  parsed_at TIMESTAMPTZ,
  parsed_by TEXT DEFAULT 'manual',  -- 'ai_claude', 'ai_openai', 'manual'
  raw_text TEXT,                     -- Texto extraído
  parsed_items JSONB,               -- Items parseados
  confidence_score NUMERIC(3,2),    -- Confianza 0-1
  
  -- Validación humana
  status TEXT DEFAULT 'pending',     -- pending, parsed, validated, rejected, error
  validated_by UUID REFERENCES tt_users(id),
  validated_at TIMESTAMPTZ,
  validation_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Tabla: `tt_stock_movements` (movimientos de stock)

Para saber stock real, en tránsito y asignado.

```sql
CREATE TABLE tt_stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES tt_products(id),
  warehouse_id UUID REFERENCES tt_warehouses(id),
  
  movement_type TEXT NOT NULL,
  -- in: ingreso (recepción, ajuste+)
  -- out: egreso (entrega, ajuste-)
  -- reserve: reserva para pedido
  -- unreserve: liberar reserva
  -- transfer_out: salida por traspaso
  -- transfer_in: ingreso por traspaso
  -- in_transit: en tránsito (comprado, no recibido)
  
  quantity INTEGER NOT NULL,          -- Positivo siempre, el tipo indica dirección
  
  -- Vinculación
  document_id UUID REFERENCES tt_documents(id),
  document_item_id UUID REFERENCES tt_document_items(id),
  reference TEXT,                     -- Referencia libre
  
  -- Tránsito
  origin_warehouse_id UUID REFERENCES tt_warehouses(id),
  destination_warehouse_id UUID REFERENCES tt_warehouses(id),
  expected_arrival DATE,
  
  notes TEXT,
  user_id UUID REFERENCES tt_users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_smov_product ON tt_stock_movements(product_id);
CREATE INDEX idx_tt_smov_warehouse ON tt_stock_movements(warehouse_id);
CREATE INDEX idx_tt_smov_document ON tt_stock_movements(document_id);
```

### Vista de stock consolidado:

```sql
CREATE OR REPLACE VIEW tt_stock_summary AS
SELECT
  sm.product_id,
  sm.warehouse_id,
  w.name as warehouse_name,
  p.sku,
  p.name as product_name,
  p.brand,
  -- Stock real (entradas - salidas)
  COALESCE(SUM(CASE WHEN sm.movement_type IN ('in','transfer_in') THEN sm.quantity ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN sm.movement_type IN ('out','transfer_out') THEN sm.quantity ELSE 0 END), 0) as stock_real,
  -- Stock reservado
  COALESCE(SUM(CASE WHEN sm.movement_type = 'reserve' THEN sm.quantity ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN sm.movement_type = 'unreserve' THEN sm.quantity ELSE 0 END), 0) as stock_reserved,
  -- Stock en tránsito
  COALESCE(SUM(CASE WHEN sm.movement_type = 'in_transit' THEN sm.quantity ELSE 0 END), 0) as stock_in_transit,
  -- Stock disponible = real - reservado
  (COALESCE(SUM(CASE WHEN sm.movement_type IN ('in','transfer_in') THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type IN ('out','transfer_out') THEN sm.quantity ELSE 0 END), 0)) -
  (COALESCE(SUM(CASE WHEN sm.movement_type = 'reserve' THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type = 'unreserve' THEN sm.quantity ELSE 0 END), 0)) as stock_available,
  -- Stock proyectado = disponible + en tránsito
  (COALESCE(SUM(CASE WHEN sm.movement_type IN ('in','transfer_in') THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type IN ('out','transfer_out') THEN sm.quantity ELSE 0 END), 0)) -
  (COALESCE(SUM(CASE WHEN sm.movement_type = 'reserve' THEN sm.quantity ELSE 0 END), 0) -
   COALESCE(SUM(CASE WHEN sm.movement_type = 'unreserve' THEN sm.quantity ELSE 0 END), 0)) +
  COALESCE(SUM(CASE WHEN sm.movement_type = 'in_transit' THEN sm.quantity ELSE 0 END), 0) as stock_projected
FROM tt_stock_movements sm
JOIN tt_products p ON p.id = sm.product_id
JOIN tt_warehouses w ON w.id = sm.warehouse_id
GROUP BY sm.product_id, sm.warehouse_id, w.name, p.sku, p.name, p.brand;
```

---

## 7. Tabla: `tt_alerts` (alertas y recordatorios)

```sql
CREATE TABLE tt_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tipo de alerta
  type TEXT NOT NULL,
  -- pending_delivery: entrega pendiente
  -- pending_purchase: compra pendiente
  -- pending_invoice: factura pendiente
  -- pending_collection: cobro pendiente
  -- stock_low: stock bajo mínimo
  -- po_overdue: pedido a proveedor atrasado
  -- quote_expiring: cotización por vencer
  -- custom: alerta manual
  
  severity TEXT DEFAULT 'info',       -- info, warning, urgent, critical
  title TEXT NOT NULL,
  description TEXT,
  
  -- Vinculación
  document_id UUID REFERENCES tt_documents(id),
  document_item_id UUID REFERENCES tt_document_items(id),
  product_id UUID REFERENCES tt_products(id),
  client_id UUID REFERENCES tt_clients(id),
  
  -- Asignación
  assigned_to UUID REFERENCES tt_users(id),
  created_by UUID REFERENCES tt_users(id),
  
  -- Estado
  status TEXT DEFAULT 'active',       -- active, snoozed, resolved, dismissed
  snooze_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES tt_users(id),
  resolution_notes TEXT,
  
  -- Configuración
  due_date DATE,
  reminder_date DATE,
  auto_generated BOOLEAN DEFAULT false,
  
  -- Notas del usuario
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_alerts_assigned ON tt_alerts(assigned_to);
CREATE INDEX idx_tt_alerts_status ON tt_alerts(status);
CREATE INDEX idx_tt_alerts_type ON tt_alerts(type);
CREATE INDEX idx_tt_alerts_due ON tt_alerts(due_date);
```

---

## 8. Tabla: `tt_delivery_doc_names` (nombres de documento de entrega por país)

```sql
CREATE TABLE tt_delivery_doc_names (
  country_code TEXT PRIMARY KEY,      -- AR, ES, US, CL, UY, BR, MX, etc.
  delivery_label TEXT NOT NULL,       -- Remito, Albarán, Delivery Note, Guía de despacho
  reception_label TEXT NOT NULL,      -- Recepción, Albarán de compra, Goods Receipt
  invoice_label TEXT NOT NULL,        -- Factura, Invoice, Nota fiscal
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO tt_delivery_doc_names (country_code, delivery_label, reception_label, invoice_label) VALUES
  ('AR', 'Remito', 'Recepción', 'Factura'),
  ('ES', 'Albarán', 'Albarán de compra', 'Factura'),
  ('US', 'Delivery Note', 'Goods Receipt', 'Invoice'),
  ('CL', 'Guía de despacho', 'Recepción', 'Factura'),
  ('UY', 'Remito', 'Recepción', 'Factura'),
  ('BR', 'Nota fiscal de remessa', 'Recebimento', 'Nota fiscal'),
  ('MX', 'Nota de remisión', 'Recepción', 'Factura'),
  ('PY', 'Remito', 'Recepción', 'Factura'),
  ('PT', 'Guia de remessa', 'Receção', 'Fatura');
```

---

## 9. Reglas de negocio — Flujo documental

### Remitos parciales (punto 7)

```
Pedido de venta (PED-2026-0001)
  Item 1: 100 unidades producto A
  Item 2: 50 unidades producto B
  
  → Remito parcial 1 (REM-2026-0001)
    Item 1: 60 unidades producto A  ← link con item_mapping qty=60
    (Item 2: no se entrega todavía)
    
  → Estado pedido: partially_fulfilled (barra amarilla)
  → Alerta automática: "Pendiente entregar: 40 uds prod A + 50 uds prod B"
  
  → Remito parcial 2 (REM-2026-0002)
    Item 1: 40 unidades producto A  ← completa la línea
    Item 2: 50 unidades producto B  ← completa la línea
    
  → Estado pedido: fulfilled (barra verde)
  → Alerta se resuelve automáticamente
```

### Stock real / en tránsito / asignado (punto 8)

| Concepto | Cálculo | Color |
|---|---|---|
| **Stock real** | Entradas - Salidas | Blanco |
| **Stock reservado** | Reservas activas para pedidos confirmados | Azul |
| **Stock disponible** | Real - Reservado | Verde/Amarillo/Rojo |
| **Stock en tránsito** | Comprado al proveedor, no recibido | Naranja |
| **Stock proyectado** | Disponible + En tránsito | Gris |

### Alertas automáticas (punto 9)

| Evento | Alerta generada | Severidad |
|---|---|---|
| Pedido con items sin stock | "Producto X sin stock — generar OC" | warning |
| OC enviada hace +7 días sin recepción | "OC-001 sin recibir — contactar proveedor" | warning |
| OC atrasada +14 días | "OC-001 atrasada 14 días" | urgent |
| Remito parcial, quedan items pendientes | "PED-001: faltan 40 uds prod A" | info |
| Cotización por vencer en 3 días | "COTI-001 vence en 3 días" | warning |
| Factura impaga hace +30 días | "FAC-001 impaga 30 días" | urgent |
| Stock bajo mínimo | "Producto X: stock 2 (mínimo: 5)" | warning |

Las alertas se generan automáticamente por triggers o al cambiar estados.

---

## 10. Barra visual de workflow — Lógica final

### El componente recibe:

```typescript
interface WorkflowBarProps {
  document: Document;           // El documento actual
  links: DocumentLink[];        // Sus vínculos padre/hijo
  company: Company;             // Para saber el país
  items: DocumentItem[];        // Para saber si alguno requiere PO
}
```

### Construye los pasos según el flujo REAL:

1. Si existe documento `client_oc` vinculado → mostrar paso "OC Cliente"
2. Si `billing_mode` incluye "advance" → mostrar "Factura anticipo" antes del remito
3. Si algún item tiene `requires_po = true` → mostrar "Compra proveedor" + "Recepción"
4. Si hay múltiples remitos parciales → mostrar "Remito (2/3)" con contador
5. Si hay factura anticipo + factura saldo → mostrar ambas
6. Si hay múltiples cobros → mostrar "Cobro (1/2)" con contador
7. El nombre del documento de entrega se obtiene de `tt_delivery_doc_names` según el país de la empresa

### Estados visuales:

| Estado | Color | Icono |
|---|---|---|
| Completado | Verde (#00C853) | ✓ |
| Actual | Naranja (#FF6600) | ● pulsante |
| Parcial | Amarillo (#FFB300) | ◐ |
| Pendiente | Gris (#4B5563) | ○ |
| Problema/Alerta | Rojo (#FF3D00) | ⚠ |

---

## Resumen de tablas nuevas

| Tabla | Función |
|---|---|
| `tt_documents` | Todos los documentos comerciales |
| `tt_document_items` | Líneas de cada documento |
| `tt_document_item_components` | Desglose interno de items |
| `tt_document_links` | Relaciones entre documentos |
| `tt_oc_parsed` | OC del cliente procesada por IA |
| `tt_stock_movements` | Movimientos de stock (real/tránsito/reserva) |
| `tt_stock_summary` (VIEW) | Vista consolidada de stock |
| `tt_alerts` | Alertas y recordatorios |
| `tt_delivery_doc_names` | Nombres de documentos por país |

Total: 7 tablas + 1 vista + 1 tabla de referencia
