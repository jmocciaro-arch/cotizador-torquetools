-- ============================================================================
-- Migración v50 — Fase 3: variantes, lotes, series, multi-idioma, feeds, reglas
-- ============================================================================
-- Schema completo para el módulo avanzado de productos. Crea todo lo que
-- necesitan las features de Fase 3 sobre tt_products legacy.
--
-- Tablas nuevas:
--   - tt_product_variants            (variantes simples por producto)
--   - tt_product_variant_attributes  (atributo+valor por variante)
--   - tt_product_lots                (trazabilidad por lote)
--   - tt_product_serials             (trazabilidad por nº de serie)
--   - tt_product_translations        (multi-idioma)
--   - tt_catalog_feeds               (configuración de feeds eCommerce)
--   - tt_catalog_rules               (reglas automáticas)
--   - tt_scheduled_exports           (exports programados)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. VARIANTES — talle/color/voltaje sobre tt_products legacy
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tt_product_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES tt_products(id) ON DELETE CASCADE,
  sku             text NOT NULL,                 -- SKU propio de la variante
  ean             text,
  manufacturer_code text,
  supplier_code   text,
  barcode         text,

  -- Hash del combo de atributos para evitar duplicados (sha256 de attrs ordenados)
  combination_hash text NOT NULL,

  price_eur       numeric(12,2),
  price_usd       numeric(12,2),
  price_ars       numeric(12,2),
  cost_eur        numeric(12,2),

  weight_kg       numeric(8,3),
  image_url       text,

  is_active       boolean NOT NULL DEFAULT true,
  lifecycle_status text DEFAULT 'activo'
                  CHECK (lifecycle_status IN ('borrador','activo','descatalogado','obsoleto')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (product_id, combination_hash)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON tt_product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku     ON tt_product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_ean     ON tt_product_variants(ean) WHERE ean IS NOT NULL;

CREATE TABLE IF NOT EXISTS tt_product_variant_attributes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  uuid NOT NULL REFERENCES tt_product_variants(id) ON DELETE CASCADE,
  attribute   text NOT NULL,        -- p.ej. 'talle', 'color', 'voltaje'
  value       text NOT NULL,        -- p.ej. 'M', 'rojo', '220V'
  UNIQUE (variant_id, attribute)
);

CREATE INDEX IF NOT EXISTS idx_variant_attrs_variant ON tt_product_variant_attributes(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_attrs_attr_value ON tt_product_variant_attributes(attribute, value);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION tt_product_variants_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON tt_product_variants;
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON tt_product_variants
  FOR EACH ROW EXECUTE FUNCTION tt_product_variants_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. LOTES — trazabilidad para EPP, calibración SAT, etc.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tt_product_lots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES tt_products(id) ON DELETE CASCADE,
  variant_id      uuid REFERENCES tt_product_variants(id) ON DELETE SET NULL,
  warehouse_id    uuid REFERENCES tt_warehouses(id) ON DELETE SET NULL,
  supplier_id     uuid REFERENCES tt_suppliers(id) ON DELETE SET NULL,

  lot_number      text NOT NULL,
  manufacture_date date,
  expiry_date     date,
  received_date   date NOT NULL DEFAULT current_date,

  qty_in          numeric(12,3) NOT NULL DEFAULT 0,
  qty_remaining   numeric(12,3) NOT NULL DEFAULT 0,

  cost_per_unit   numeric(12,4),
  notes           text,
  status          text NOT NULL DEFAULT 'activo'
                  CHECK (status IN ('activo','agotado','vencido','retenido','descartado')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (product_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_product_lots_product   ON tt_product_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_product_lots_warehouse ON tt_product_lots(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_product_lots_expiry    ON tt_product_lots(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_lots_status    ON tt_product_lots(status);

-- ----------------------------------------------------------------------------
-- 3. NÚMEROS DE SERIE — para torquímetros calibrados, SAT
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tt_product_serials (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES tt_products(id) ON DELETE CASCADE,
  variant_id          uuid REFERENCES tt_product_variants(id) ON DELETE SET NULL,
  lot_id              uuid REFERENCES tt_product_lots(id) ON DELETE SET NULL,
  warehouse_id        uuid REFERENCES tt_warehouses(id) ON DELETE SET NULL,

  serial_number       text NOT NULL,
  status              text NOT NULL DEFAULT 'en_stock'
                      CHECK (status IN ('en_stock','reservado','vendido','en_servicio','en_calibracion','baja','garantia')),

  current_owner_type  text                          -- 'client', 'supplier', 'internal', null
                      CHECK (current_owner_type IS NULL OR current_owner_type IN ('client','supplier','internal')),
  current_owner_id    uuid,

  next_calibration_date date,
  last_calibration_date date,
  warranty_until      date,

  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (serial_number)
);

CREATE INDEX IF NOT EXISTS idx_product_serials_product ON tt_product_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_lot     ON tt_product_serials(lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_serials_status  ON tt_product_serials(status);
CREATE INDEX IF NOT EXISTS idx_product_serials_calib   ON tt_product_serials(next_calibration_date) WHERE next_calibration_date IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. MULTI-IDIOMA — traducciones de campos de texto del producto
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tt_product_translations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES tt_products(id) ON DELETE CASCADE,
  locale            text NOT NULL,                 -- 'es', 'en', 'pt', 'fr', etc. (BCP-47 corto)

  name              text,
  description       text,
  short_description text,
  seo_title         text,
  seo_description   text,
  seo_keywords      text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (product_id, locale)
);

CREATE INDEX IF NOT EXISTS idx_product_translations_product ON tt_product_translations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_translations_locale  ON tt_product_translations(locale);

CREATE OR REPLACE FUNCTION tt_product_translations_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_translations_updated_at ON tt_product_translations;
CREATE TRIGGER trg_product_translations_updated_at
  BEFORE UPDATE ON tt_product_translations
  FOR EACH ROW EXECUTE FUNCTION tt_product_translations_set_updated_at();

-- Helper: traer texto en un locale, fallback a tt_products si no hay traducción
CREATE OR REPLACE FUNCTION get_product_text(p_product_id uuid, p_locale text, p_field text)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  EXECUTE format('SELECT %I FROM tt_product_translations WHERE product_id=$1 AND locale=$2', p_field)
    INTO v USING p_product_id, p_locale;
  IF v IS NOT NULL AND v <> '' THEN RETURN v; END IF;
  EXECUTE format('SELECT %I FROM tt_products WHERE id=$1', p_field) INTO v USING p_product_id;
  RETURN v;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. FEEDS eCOMMERCE — configuración de feeds Google/Meta/ML/Amazon
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tt_catalog_feeds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES tt_companies(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES tt_users(id) ON DELETE SET NULL,

  name            text NOT NULL,                 -- "Google Shopping ES"
  feed_type       text NOT NULL                  -- destino del feed
                  CHECK (feed_type IN ('google_shopping','meta_catalog','mercadolibre','amazon','custom_xml','custom_csv')),

  -- Filtro: qué productos van en este feed
  filter          jsonb NOT NULL DEFAULT '{}'::jsonb,
                  -- ej: {"categories":["EPP"], "lifecycle_status":["activo"], "min_stock": 1}

  -- Mapping de campos: cómo se renombra cada field interno al header del feed
  field_mapping   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Opciones de generación
  options         jsonb NOT NULL DEFAULT '{}'::jsonb,
                  -- ej: {"locale":"es","currency":"EUR","include_variants":true}

  -- URL pública del feed generado (Vercel sirve dinámico desde /api/catalog/feed/[id])
  public_token    text UNIQUE,                  -- token que va en la URL pública
  is_public       boolean NOT NULL DEFAULT false,

  last_generated_at timestamptz,
  last_item_count integer,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_feeds_company ON tt_catalog_feeds(company_id);
CREATE INDEX IF NOT EXISTS idx_catalog_feeds_token   ON tt_catalog_feeds(public_token) WHERE public_token IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. REGLAS AUTOMÁTICAS — engine ligero de reglas sobre el catálogo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tt_catalog_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES tt_companies(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES tt_users(id) ON DELETE SET NULL,

  name            text NOT NULL,                 -- "Alerta cambio coste > 5%"
  description     text,

  trigger_event   text NOT NULL                  -- evento que dispara
                  CHECK (trigger_event IN (
                    'product_updated',           -- al guardar cambios
                    'cost_changed',              -- cuando cambia el cost_eur
                    'price_changed',             -- cuando cambia el price_eur
                    'stock_low',                 -- stock < min
                    'stock_zero',                -- stock = 0
                    'product_created',
                    'lifecycle_changed',
                    'scheduled_daily',           -- corre todos los días via cron
                    'scheduled_weekly'
                  )),

  -- Condiciones a evaluar (AND lógico): [{field, op, value}]
  -- ops: gt, lt, eq, neq, gte, lte, change_pct_gt, change_pct_lt, in, not_in, contains
  conditions      jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Acciones a ejecutar: [{type, params}]
  -- types: notify_user, notify_email, create_oc_draft, update_field, log_to_audit, webhook
  actions         jsonb NOT NULL DEFAULT '[]'::jsonb,

  is_active       boolean NOT NULL DEFAULT true,
  priority        integer NOT NULL DEFAULT 100,
  last_fired_at   timestamptz,
  fire_count      integer NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_rules_company ON tt_catalog_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_catalog_rules_event   ON tt_catalog_rules(trigger_event) WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 7. EXPORTS PROGRAMADOS — cron para exports recurrentes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tt_scheduled_exports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES tt_companies(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES tt_users(id) ON DELETE SET NULL,

  name            text NOT NULL,                 -- "Lista precios mensual cliente X"
  target_table    text NOT NULL,                 -- tt_products, tt_clients, etc.
  format          text NOT NULL                  -- xlsx | csv | xml | json | pdf
                  CHECK (format IN ('xlsx','csv','xml','json','pdf')),
  template_id     uuid REFERENCES tt_import_templates(id) ON DELETE SET NULL,
                                                 -- opcional: usa column_mapping del template para seleccionar columnas
  filter          jsonb NOT NULL DEFAULT '{}'::jsonb,

  schedule_cron   text NOT NULL,                 -- cron expression, ej '0 9 * * 1' = lun 09:00
  delivery_type   text NOT NULL                  -- email | webhook | storage
                  CHECK (delivery_type IN ('email','webhook','storage')),
  delivery_config jsonb NOT NULL DEFAULT '{}'::jsonb,
                  -- email: {to:["a@b.com"], subject, body}
                  -- webhook: {url, headers}
                  -- storage: {path}

  is_active       boolean NOT NULL DEFAULT true,
  last_run_at     timestamptz,
  last_run_status text                            -- success | failed | running
                  CHECK (last_run_status IS NULL OR last_run_status IN ('success','failed','running')),
  last_error      text,
  next_run_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_exports_company  ON tt_scheduled_exports(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_exports_next_run ON tt_scheduled_exports(next_run_at) WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- 8. RLS — todas las tablas nuevas
-- ----------------------------------------------------------------------------
ALTER TABLE tt_product_variants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_product_variant_attributes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_product_lots                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_product_serials             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_product_translations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_catalog_feeds               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_catalog_rules               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tt_scheduled_exports           ENABLE ROW LEVEL SECURITY;

-- Permisivas: cualquier usuario autenticado lee/escribe (mismo patrón que tt_products en Mocciaro)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tt_product_variants','tt_product_variant_attributes','tt_product_lots',
    'tt_product_serials','tt_product_translations','tt_catalog_feeds',
    'tt_catalog_rules','tt_scheduled_exports'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS auth_all ON %I', t);
    EXECUTE format('CREATE POLICY auth_all ON %I FOR ALL USING (auth.role() = ''authenticated'')', t);
  END LOOP;
END $$;

-- Feeds: política extra para servir el endpoint público con anon key
DROP POLICY IF EXISTS catalog_feeds_public_read ON tt_catalog_feeds;
CREATE POLICY catalog_feeds_public_read ON tt_catalog_feeds
  FOR SELECT USING (is_public = true AND public_token IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 9. RPCs útiles
-- ----------------------------------------------------------------------------

-- Encontrar variantes que matchean un combo de atributos
CREATE OR REPLACE FUNCTION find_variant_by_attrs(
  p_product_id uuid,
  p_attrs jsonb
) RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_variant_id uuid;
BEGIN
  SELECT v.id INTO v_variant_id
  FROM tt_product_variants v
  WHERE v.product_id = p_product_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each_text(p_attrs) attr(k,v_val)
      WHERE NOT EXISTS (
        SELECT 1 FROM tt_product_variant_attributes va
        WHERE va.variant_id = v.id AND va.attribute = attr.k AND va.value = attr.v_val
      )
    )
  LIMIT 1;
  RETURN v_variant_id;
END;
$$;

-- Listar lotes próximos a vencer
CREATE OR REPLACE FUNCTION list_lots_expiring_soon(p_days_ahead integer DEFAULT 30)
RETURNS TABLE (
  lot_id          uuid,
  product_id      uuid,
  product_name    text,
  lot_number      text,
  expiry_date     date,
  qty_remaining   numeric,
  days_to_expiry  integer
) LANGUAGE sql STABLE AS $$
  SELECT l.id, l.product_id, p.name, l.lot_number, l.expiry_date, l.qty_remaining,
         (l.expiry_date - current_date)::integer
  FROM tt_product_lots l
  JOIN tt_products p ON p.id = l.product_id
  WHERE l.expiry_date IS NOT NULL
    AND l.expiry_date <= (current_date + (p_days_ahead || ' days')::interval)
    AND l.status = 'activo'
    AND l.qty_remaining > 0
  ORDER BY l.expiry_date ASC;
$$;

-- Listar series con calibración próxima
CREATE OR REPLACE FUNCTION list_serials_calibration_due(p_days_ahead integer DEFAULT 30)
RETURNS TABLE (
  serial_id            uuid,
  product_id           uuid,
  product_name         text,
  serial_number        text,
  next_calibration_date date,
  days_to_calibration  integer,
  current_owner_type   text,
  current_owner_id     uuid
) LANGUAGE sql STABLE AS $$
  SELECT s.id, s.product_id, p.name, s.serial_number, s.next_calibration_date,
         (s.next_calibration_date - current_date)::integer,
         s.current_owner_type, s.current_owner_id
  FROM tt_product_serials s
  JOIN tt_products p ON p.id = s.product_id
  WHERE s.next_calibration_date IS NOT NULL
    AND s.next_calibration_date <= (current_date + (p_days_ahead || ' days')::interval)
    AND s.status NOT IN ('baja')
  ORDER BY s.next_calibration_date ASC;
$$;

COMMIT;

-- ============================================================================
-- Verificación post-migración (correr manualmente)
-- ============================================================================
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'tt_product_%' OR tablename LIKE 'tt_catalog_%' OR tablename LIKE 'tt_scheduled%' ORDER BY 1;
-- SELECT count(*) FROM tt_product_variants;
-- SELECT count(*) FROM tt_product_lots;
-- SELECT count(*) FROM tt_product_serials;
-- SELECT count(*) FROM tt_product_translations;
-- SELECT count(*) FROM tt_catalog_feeds;
-- SELECT count(*) FROM tt_catalog_rules;
-- SELECT count(*) FROM tt_scheduled_exports;
