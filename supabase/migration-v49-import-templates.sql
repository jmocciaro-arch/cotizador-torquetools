-- ============================================================================
-- Migración v49 — Plantillas de import guardables
-- ============================================================================
-- Soporta Fase 2: cada usuario/empresa puede guardar el mapeo + transformaciones
-- de un proveedor recurrente y reutilizarlo en futuros imports.
--
-- Cambios:
-- 1. tt_import_templates: plantilla = profile_id + column_mapping + transforms +
--    options (modo, dry-run default, key column).
-- 2. Indices y RLS.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS tt_import_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES tt_users(id) ON DELETE CASCADE,
  company_id      uuid REFERENCES tt_companies(id) ON DELETE CASCADE,

  name            text NOT NULL,                 -- "Proveedor X — lista mensual"
  description     text,
  target_table    text NOT NULL,                 -- tt_products, tt_clients, etc.
  profile_id      text,                          -- 'stelorder', 'odoo', 'holded', 'shopify', 'custom', ...

  -- Mapeo: { csv_column: target_field } por ej. { "Ref. Articulo": "sku" }
  column_mapping  jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Transformaciones por columna:
  -- [{ column: "Precio", steps: [{op:"multiply", value:1.21}, {op:"round", value:2}] }]
  transforms      jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Opciones del job: { mode, dry_run, key_column, partial_fields, sync_filter }
  options         jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_shared       boolean NOT NULL DEFAULT false,  -- compartida con la empresa
  is_default      boolean NOT NULL DEFAULT false,  -- default por (user_id, target_table)
  use_count       integer NOT NULL DEFAULT 0,
  last_used_at    timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_templates_user    ON tt_import_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_import_templates_company ON tt_import_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_import_templates_target  ON tt_import_templates(target_table);

CREATE OR REPLACE FUNCTION tt_import_templates_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_import_templates_updated_at ON tt_import_templates;
CREATE TRIGGER trg_import_templates_updated_at
  BEFORE UPDATE ON tt_import_templates
  FOR EACH ROW EXECUTE FUNCTION tt_import_templates_set_updated_at();

ALTER TABLE tt_import_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS templates_select ON tt_import_templates;
CREATE POLICY templates_select ON tt_import_templates
  FOR SELECT USING (
    user_id = auth.uid()
    OR (is_shared = true AND EXISTS (
      SELECT 1 FROM tt_user_companies uc
       WHERE uc.user_id = auth.uid() AND uc.company_id = tt_import_templates.company_id
    ))
  );

DROP POLICY IF EXISTS templates_insert ON tt_import_templates;
CREATE POLICY templates_insert ON tt_import_templates
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS templates_update ON tt_import_templates;
CREATE POLICY templates_update ON tt_import_templates
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS templates_delete ON tt_import_templates;
CREATE POLICY templates_delete ON tt_import_templates
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE  tt_import_templates IS 'Plantillas de import reutilizables por usuario/empresa. Guarda mapeo de columnas + transformaciones + opciones.';
COMMENT ON COLUMN tt_import_templates.transforms IS 'Pipeline por columna: [{column,steps:[{op,value}...]}]. Ops: trim,upper,lower,slugify,regex_replace,multiply,divide,add,subtract,add_pct,round,concat,split,prefix,suffix,fx_convert.';
COMMENT ON COLUMN tt_import_templates.options IS 'mode: insert|update|upsert|sync|partial. partial_fields: array de campos a actualizar. sync_filter: query SQL adicional para definir el universo del sync (p.ej. category=X).';

COMMIT;
