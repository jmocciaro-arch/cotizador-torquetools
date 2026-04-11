# Schema de Trazabilidad Documental — v2 (corregido)

## Tabla: `tt_documents`

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | Identificador único |
| type | TEXT NOT NULL | Función del documento: `request`, `client_oc`, `quote`, `sales_order`, `purchase_order`, `reception`, `delivery_note`, `invoice`, `payment` |
| subtype | TEXT | Rol específico: `standard`, `advance_partial`, `advance_full`, `credit_note`, `debit_note`, `return` |
| system_code | TEXT UNIQUE NOT NULL | Correlativo interno INMUTABLE: COTI-2026-00001, PED-2026-00001 |
| display_ref | TEXT | Referencia visible/editable por el usuario |
| legal_number | TEXT | Número fiscal/legal (factura AFIP, factura SII, etc.) |
| company_id | UUID FK → tt_companies | Empresa emisora |
| client_id | UUID FK → tt_clients | Cliente |
| user_id | UUID FK → tt_users | Quien lo creó |
| assigned_to | UUID FK → tt_users | Responsable actual |
| status | TEXT NOT NULL DEFAULT 'draft' | Ver estados abajo |
| billing_mode | TEXT DEFAULT 'standard' | `standard`, `advance_partial`, `advance_full`, `mixed` |
| currency | TEXT DEFAULT 'EUR' | Moneda del documento |
| exchange_rate | NUMERIC(10,4) DEFAULT 1 | Tipo de cambio al momento |
| subtotal | NUMERIC(12,2) DEFAULT 0 | |
| tax_rate | NUMERIC(5,2) DEFAULT 21 | Tasa impositiva aplicada |
| tax_amount | NUMERIC(12,2) DEFAULT 0 | |
| total | NUMERIC(12,2) DEFAULT 0 | |
| incoterm | TEXT | EXW, FCA, FOB, CIF, DDP |
| payment_terms | TEXT | Condiciones de pago |
| delivery_address | TEXT | Dirección de entrega |
| delivery_date | DATE | Fecha comprometida |
| valid_until | DATE | Validez (para cotizaciones) |
| notes | TEXT | Notas visibles al cliente |
| internal_notes | TEXT | Notas internas (solo staff) |
| localized_label | TEXT | Nombre del documento según país: "Remito", "Albarán", "Delivery Note" |
| metadata | JSONB DEFAULT '{}' | Datos extra flexibles |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### Estados operativos (`status`)

| Estado | Descripción |
|---|---|
| `draft` | Borrador, editable |
| `pending_validation` | Esperando validación contra OC |
| `validated` | Validado contra OC del cliente |
| `sent` | Enviado al cliente |
| `accepted` | Aceptado por el cliente |
| `partially_fulfilled` | Parcialmente entregado/recibido |
| `fulfilled` | Completamente entregado/recibido |
| `partially_invoiced` | Parcialmente facturado |
| `invoiced` | Completamente facturado |
| `partially_collected` | Parcialmente cobrado |
| `collected` | Completamente cobrado |
| `closed` | Cerrado (inmutable) |
| `cancelled` | Cancelado |

---

## Tabla: `tt_document_items` (líneas de cada documento)

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| document_id | UUID FK → tt_documents | Documento padre |
| product_id | UUID FK → tt_products | Puede ser NULL si es item genérico/servicio |
| oc_line_ref | TEXT | Referencia al item de la OC del cliente |
| sku | TEXT | SKU del producto |
| description | TEXT | Lo que ve el cliente |
| internal_description | TEXT | Descripción interna detallada |
| quantity | NUMERIC(10,2) DEFAULT 0 | Cantidad del documento |
| unit_price | NUMERIC(12,2) DEFAULT 0 | Precio unitario |
| unit_cost | NUMERIC(12,2) DEFAULT 0 | Costo unitario |
| cost_snapshot | NUMERIC(12,2) | Costo congelado al facturar |
| discount_pct | NUMERIC(5,2) DEFAULT 0 | Descuento % |
| subtotal | NUMERIC(12,2) DEFAULT 0 | |
| qty_delivered | NUMERIC(10,2) DEFAULT 0 | Acumulado entregado |
| qty_invoiced | NUMERIC(10,2) DEFAULT 0 | Acumulado facturado |
| qty_received | NUMERIC(10,2) DEFAULT 0 | Acumulado recibido (compras) |
| requires_po | BOOLEAN DEFAULT false | Este ítem necesita compra a proveedor |
| po_status | TEXT | Estado de la compra: null, ordered, partial, received |
| notes | TEXT | Notas por línea |
| sort_order | INTEGER DEFAULT 0 | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

---

## Tabla: `tt_document_item_components` (desglose interno de items)

Para el caso: OC dice "Ferretería" → internamente son 5 productos.

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| parent_item_id | UUID FK → tt_document_items | Item padre (lo que ve el cliente) |
| product_id | UUID FK → tt_products | Producto real del catálogo |
| sku | TEXT | |
| description | TEXT | |
| quantity | NUMERIC(10,2) | Cantidad de este componente |
| unit_cost | NUMERIC(12,2) | Costo unitario |
| source_oc_line_ref | TEXT | De qué línea de la OC viene |
| created_at | TIMESTAMPTZ DEFAULT now() | |

---

## Tabla: `tt_document_links` (relaciones entre documentos)

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| parent_id | UUID FK → tt_documents | Documento origen |
| child_id | UUID FK → tt_documents | Documento generado |
| relation_type | TEXT NOT NULL | Ver tipos abajo |
| item_mapping | JSONB | Mapeo de líneas parciales entre docs |
| notes | TEXT | Observación de la relación |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### Tipos de relación (`relation_type`)

| Tipo | Significado | Ejemplo |
|---|---|---|
| `generated_from` | Hijo generado desde padre | Pedido generado desde Cotización |
| `validated_against` | Validado contra | Cotización validada contra OC del cliente |
| `fulfills` | Cumple/entrega | Remito cumple parcialmente un Pedido |
| `invoices` | Factura | Factura cubre uno o varios remitos |
| `collects` | Cobra | Cobro asociado a una factura |
| `covers` | Cubre | Factura anticipo cubre parte del pedido |
| `requests_purchase` | Genera compra | Pedido de venta genera Pedido a proveedor |
| `receives` | Recepción | Recepción de mercadería de un Pedido a proveedor |

### `item_mapping` ejemplo:

```json
[
  {
    "parent_item_id": "uuid-item-pedido-linea-1",
    "child_item_id": "uuid-item-remito-linea-1",
    "qty_mapped": 30
  },
  {
    "parent_item_id": "uuid-item-pedido-linea-2",
    "child_item_id": "uuid-item-remito-linea-2",
    "qty_mapped": 50
  }
]
```

Esto permite entregas parciales por línea con trazabilidad exacta.

---

## Tabla: `tt_oc_parsed` (OC del cliente procesada por IA)

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID PK | |
| document_id | UUID FK → tt_documents | Documento tipo `client_oc` |
| file_url | TEXT | URL del archivo subido |
| file_name | TEXT | Nombre original |
| parsed_at | TIMESTAMPTZ | Cuándo se procesó |
| parsed_by | TEXT | 'ai' o 'manual' |
| raw_text | TEXT | Texto extraído del PDF/imagen |
| parsed_items | JSONB | Items parseados por IA |
| confidence_score | NUMERIC(3,2) | Confianza del parseo (0-1) |
| status | TEXT | 'pending', 'parsed', 'validated', 'error' |
| validated_by | UUID FK → tt_users | Quién validó el parseo |
| validated_at | TIMESTAMPTZ | |

### `parsed_items` ejemplo:

```json
[
  {
    "line": 1,
    "oc_ref": "ITEM-001",
    "description": "Atornillador neumático 18V",
    "quantity": 10,
    "unit_price": 450.00,
    "mapped_products": [
      {"product_id": "uuid", "sku": "ASM18-8", "qty": 10, "confidence": 0.95}
    ]
  },
  {
    "line": 2,
    "oc_ref": "ITEM-002",
    "description": "Ferretería varios",
    "quantity": 1,
    "unit_price": 2000.00,
    "mapped_products": [
      {"product_id": "uuid1", "sku": "BOLT-M8", "qty": 100, "confidence": 0.7},
      {"product_id": "uuid2", "sku": "NUT-M8", "qty": 100, "confidence": 0.7},
      {"product_id": "uuid3", "sku": "WASHER-M8", "qty": 200, "confidence": 0.6}
    ]
  }
]
```

---

## Flujos documentales

### Flujo A: Venta estándar con stock

```
[Solicitud] → [OC cliente] → [Cotización] → [Pedido venta] → [Remito/Albarán] → [Factura] → [Cobro]
     ↕              ↕              ↕               ↕                ↕               ↕          ↕
  request      client_oc        quote         sales_order      delivery_note      invoice    payment
```

### Flujo B: Sin stock (requiere compra)

```
[Cotización] → [Pedido venta] → [Pedido proveedor] → [Recepción] → [Remito] → [Factura] → [Cobro]
                                    ↕                     ↕
                              purchase_order          reception
```

### Flujo C: Factura anticipada

```
[Cotización] → [Pedido venta] → [Factura anticipo] → [Remito] → [Cobro/Imputación]
                                  subtype: advance_partial
                                  billing_mode: advance_partial
```

### Flujo D: Mixto (algunos items en stock, otros a comprar)

```
[Pedido venta]
  ├── Item 1 (en stock) → [Remito parcial 1]
  ├── Item 2 (sin stock) → [Pedido proveedor] → [Recepción] → [Remito parcial 2]
  └── [Factura unificada] → [Cobro]
```

---

## Barra visual de workflow

La barra se construye dinámicamente según:

1. **Tipo de empresa** (país) → nombre del documento de entrega
2. **billing_mode** → si hay anticipos, mostrar factura antes del remito
3. **requires_po a nivel item** → si algún item requiere compra, mostrar etapa PAP
4. **Estado real** → qué documentos hijo existen en tt_document_links

### Lógica del componente:

```typescript
function getWorkflowSteps(document, links, company) {
  const deliveryLabel = company.country === 'AR' ? 'Remito' 
    : company.country === 'ES' ? 'Albarán' 
    : company.delivery_doc_label || 'Delivery Note';

  const steps = [
    { key: 'request', label: 'Solicitud', icon: '📋' },
    { key: 'quote', label: 'Cotización', icon: '📝' },
    { key: 'sales_order', label: 'Pedido', icon: '📦' },
  ];

  // Si algún item requiere compra
  if (document.items?.some(i => i.requires_po)) {
    steps.push({ key: 'purchase_order', label: 'Compra proveedor', icon: '🏭' });
    steps.push({ key: 'reception', label: 'Recepción', icon: '📥' });
  }

  // Si tiene factura anticipada, va antes del remito
  if (document.billing_mode?.includes('advance')) {
    steps.push({ key: 'invoice_advance', label: 'Factura anticipo', icon: '💳' });
  }

  steps.push({ key: 'delivery_note', label: deliveryLabel, icon: '🚚' });

  // Factura estándar (si no es anticipo total)
  if (document.billing_mode !== 'advance_full') {
    steps.push({ key: 'invoice', label: 'Factura', icon: '🧾' });
  }

  steps.push({ key: 'payment', label: 'Cobro', icon: '💰' });

  // Marcar estados según links existentes
  const completedTypes = new Set(links.map(l => l.child_type));
  const currentType = document.type;

  return steps.map(s => ({
    ...s,
    status: completedTypes.has(s.key) ? 'completed'
      : s.key === currentType ? 'current'
      : 'pending'
  }));
}
```

---

## Reglas de negocio

1. Al generar documento hijo → padre cambia a `closed` (inmutable)
2. `system_code` es auto-incremental y NUNCA se edita
3. `display_ref` es libre, el usuario la pone como quiera
4. `legal_number` se llena solo al emitir factura fiscal (Tango/AFIP)
5. `cost_snapshot` se congela al generar factura → margen histórico no cambia
6. Al cambiar estado → se registra en `tt_activity_log`
7. Entregas parciales: se crea nuevo `delivery_note` vinculado al `sales_order` con `item_mapping` indicando qué cantidad de qué línea se entrega
8. Factura multi-remito: una factura con `relation_type: 'invoices'` hacia N remitos, con item_mapping consolidado
