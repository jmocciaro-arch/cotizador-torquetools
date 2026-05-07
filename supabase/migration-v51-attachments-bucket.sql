-- Migration v51 — Bucket de adjuntos genéricos para documentos
--
-- WHY: src/components/workflow/document-form.tsx sube adjuntos al bucket
-- `attachments` desde el tab Adjuntos del editor de documento. El bucket
-- nunca había sido creado, así que la subida fallaba silently y los links
-- a los adjuntos quedaban rotos.
--
-- HOW TO APPLY: ejecutar en Supabase SQL Editor (dashboard del proyecto).
-- Idempotente: si el bucket ya existe lo deja como está. Las policies se
-- recrean por DROP+CREATE para mantenerlas alineadas con el patrón actual
-- (mismo que client-pos / bank-statements / supplier-offers / invoices).

BEGIN;

-- 1. Crear el bucket privado.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false, -- privado: el código usa createSignedUrl()
  52428800, -- 50 MB por archivo
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies de RLS — alineadas con el resto de buckets privados del proyecto.
-- Lectura/escritura/borrado: cualquier usuario autenticado. La autorización
-- fina vive a nivel aplicación (RBAC + visibleCompanies).

DROP POLICY IF EXISTS "attachments_select_authenticated" ON storage.objects;
CREATE POLICY "attachments_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_insert_authenticated" ON storage.objects;
CREATE POLICY "attachments_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_update_authenticated" ON storage.objects;
CREATE POLICY "attachments_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_delete_authenticated" ON storage.objects;
CREATE POLICY "attachments_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');

-- 3. Verificación
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attachments') THEN
    RAISE EXCEPTION 'migration v51: bucket attachments no creado';
  END IF;
END
$$;

COMMIT;
