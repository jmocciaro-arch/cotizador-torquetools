-- ============================================================================
-- Migración v48 — Product import audit + multi-código + lifecycle status
-- ============================================================================
-- Soporta Fase 1 del plan de gestión avanzada de productos.
--
-- Cambios:
-- 1. Nueva tabla tt_import_jobs: log persistente de cada importación
--    (rollback 1-clic, auditoría, reproducibilidad).
-- 2. Nuevas columnas en tt_products:
--    - ean              (EAN-13 / GTIN)
--    - manufacturer_code (referencia del fabricante)
--    - supplier_code     (referencia interna del proveedor)
--    - lifecycle_status  (borrador / activo / descatalogado / obsoleto)
-- 3. Índices y constraints.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. tt_import_jobs — audit trail de todas las importaciones
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tt_import_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES tt_users(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES tt_companies(id) ON DELETE SET NULL,

  target_table    text NOT NULL,           -- tt_products, tt_clients, etc.
  source_format   text,                    -- csv | xlsx | xls | tsv | json | clipboard
  source_profile  text,                    -- stelorder | woocommerce | odoo | manual | ...
  file_name       text,
  file_size_bytes bigint,
  file_storage_path text,                  -- ruta en supabase storage si se guardó

  mode            text NOT NULL DEFAULT 'upsert'
                  CHECK (mode IN ('insert', 'update', 'upsert', 'sync', 'partial', 'dry_run')),
  dry_run         boolean NOT NULL DEFAULT false,

  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'reverted', 'partial')),

  rows_total      integer DEFAULT 0,
  rows_inserted   integer DEFAULT 0,
  rows_updated    integer DEFAULT 0,
  rows_skipped    integer DEFAULT 0,
  rows_failed     integer DEFAULT 0,

  -- Detalle por fila: [{row_index, action, entity_id, before, after, error}]
  -- Permite reversión: replay before sobre cada entity_id afectado.
  row_log         jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Snapshot del mapeo aplicado (header CSV → field destino)
  column_mapping  jsonb,
  -- Filtros / opciones del job
  options         jsonb DEFAULT '{}'::jsonb,
  -- Errores globales (no por fila)
  errors          jsonb DEFAULT '[]'::jsonb,

  reverted_at     timestamptz,
  reverted_by     uuid REFERENCES tt_users(id) ON DELETE SET NULL,
  revert_job_id   uuid REFERENCES tt_import_jobs(id) ON DELETE SET NULL,

  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user        ON tt_import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_company     ON tt_import_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_target      ON tt_import_jobs(target_table);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status      ON tt_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at  ON tt_import_jobs(created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION tt_import_jobs_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_import_jobs_updated_at ON tt_import_jobs;
CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON tt_import_jobs
  FOR EACH ROW EXECUTE FUNCTION tt_import_jobs_set_updated_at();

-- RLS — un usuario ve sus jobs y los de su empresa activa
ALTER TABLE tt_import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_jobs_select ON tt_import_jobs;
CREATE POLICY import_jobs_select ON tt_import_jobs
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tt_user_companies uc
       WHERE uc.user_id = auth.uid() AND uc.company_id = tt_import_jobs.company_id
    )
  );

DROP POLICY IF EXISTS import_jobs_insert ON tt_import_jobs;
CREATE POLICY import_jobs_insert ON tt_import_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS import_jobs_update ON tt_import_jobs;
CREATE POLICY import_jobs_update ON tt_import_jobs
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tt_user_companies uc
       WHERE uc.user_id = auth.uid() AND uc.company_id = tt_import_jobs.company_id
    )
  );

COMMENT ON TABLE  tt_import_jobs IS 'Log persistente de cada importación de datos. Permite auditoría y rollback 1-clic.';
COMMENT ON COLUMN tt_import_jobs.row_log IS 'Detalle por fila con before/after — usado para revertir el job replicando before sobre los entity_id afectados.';

-- ----------------------------------------------------------------------------
-- 2. tt_products — multi-código + lifecycle status
-- ----------------------------------------------------------------------------

-- Multi-código
ALTER TABLE tt_products ADD COLUMN IF NOT EXISTS ean               text;
ALTER TABLE tt_products ADD COLUMN IF NOT EXISTS manufacturer_code text;
ALTER TABLE tt_products ADD COLUMN IF NOT EXISTS supplier_code     text;

-- Lifecycle status (más granular que active/inactive)
ALTER TABLE tt_products ADD COLUMN IF NOT EXISTS lifecycle_status text
  CHECK (lifecycle_status IN ('borrador', 'activo', 'descatalogado', 'obsoleto'));

-- Backfill: lo que está active=true → 'activo', el resto → 'descatalogado'
UPDATE tt_products
   SET lifecycle_status = CASE WHEN active = true THEN 'activo' ELSE 'descatalogado' END
 WHERE lifecycle_status IS NULL;

ALTER TABLE tt_products ALTER COLUMN lifecycle_status SET DEFAULT 'activo';

-- Índices para búsqueda por cualquiera de los códigos
CREATE INDEX IF NOT EXISTS idx_products_ean               ON tt_products(ean) WHERE ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_manufacturer_code ON tt_products(manufacturer_code) WHERE manufacturer_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_supplier_code     ON tt_products(supplier_code) WHERE supplier_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_status  ON tt_products(lifecycle_status);

COMMENT ON COLUMN tt_products.ean IS 'Código de barras EAN-13 / GTIN del producto (estándar global).';
COMMENT ON COLUMN tt_products.manufacturer_code IS 'Referencia / part number del fabricante.';
COMMENT ON COLUMN tt_products.supplier_code IS 'Referencia interna del proveedor preferido.';
COMMENT ON COLUMN tt_products.lifecycle_status IS 'Estado del ciclo de vida: borrador (no listable), activo, descatalogado (no se compra más, se vende stock), obsoleto (oculto en catálogo).';

-- ----------------------------------------------------------------------------
-- 3. RPC para búsqueda multi-código (usado por scanner / cotizador)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_product_by_any_code(p_code text)
RETURNS SETOF tt_products
LANGUAGE sql STABLE AS $$
  SELECT * FROM tt_products
   WHERE sku                = p_code
      OR ean                = p_code
      OR manufacturer_code  = p_code
      OR supplier_code      = p_code
      OR barcode            = p_code
   LIMIT 5;
$$;

COMMENT ON FUNCTION find_product_by_any_code IS 'Busca un producto por sku, ean, manufacturer_code, supplier_code o barcode. Útil para scanner y autocompletado.';

COMMIT;

-- ============================================================================
-- Verificación post-migración (correr manualmente)
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'tt_products' AND column_name IN ('ean','manufacturer_code','supplier_code','lifecycle_status');
-- SELECT count(*) FROM tt_import_jobs;
-- SELECT lifecycle_status, count(*) FROM tt_products GROUP BY 1;
