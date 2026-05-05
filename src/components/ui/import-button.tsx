'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, Loader2, X, ArrowRight, RefreshCw, FileSpreadsheet, Clipboard, Eye, Undo2, Sparkles, Save, Trash2, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { parseCSV, readFileAsText, parseXLSX, isXLSXFile } from '@/lib/csv-parser'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/use-permissions'
import { useToast } from '@/components/ui/toast'
import {
  detectStelOrderFormat,
  UPSERT_KEYS,
  expandDotNotation,
  postProcessProductRecord,
  type StelOrderDetection,
} from '@/lib/stelorder-mappings'
import { createImportJob, updateImportJob, revertImportJob, type ImportJobRow } from '@/lib/import-jobs'
import { PROFILES, getProfile, detectProfile, type ProfileDetection } from '@/lib/import-profiles/registry'
import type { TargetTable, TransformStep, TransformOp } from '@/lib/import-profiles/types'
import { applyTransforms } from '@/lib/import-profiles/transforms'
import {
  listTemplates,
  saveTemplate,
  bumpUsage,
  deleteTemplate,
  type ImportTemplate,
  type ImportMode,
  type TemplateTransformBlock,
} from '@/lib/import-templates'
import { findDuplicateCandidates, type DuplicateCandidate } from '@/lib/fuzzy-duplicates'

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ImportField {
  key: string
  label: string
  required?: boolean
  type?: 'text' | 'number' | 'date' | 'boolean'
}

export interface ImportResults {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

interface ImportButtonProps {
  targetTable: string
  fields: ImportField[]
  onComplete?: (results: ImportResults) => void
  permission?: string
  label?: string
  className?: string
}

type MappingState = Record<number, string> // csv column index -> field key
type ColTransforms = Record<number, TransformStep[]> // csv column index -> steps
type DupDecision = 'pending' | 'ignore' | 'skip' | { merge_with_sku: string }

const TRANSFORM_OP_LABELS: Record<TransformOp, string> = {
  trim: 'Recortar espacios',
  upper: 'Mayúsculas',
  lower: 'Minúsculas',
  slugify: 'Slug (kebab-case)',
  regex_replace: 'Reemplazar regex',
  replace: 'Reemplazar texto',
  multiply: 'Multiplicar ×',
  divide: 'Dividir ÷',
  add: 'Sumar +',
  subtract: 'Restar −',
  add_pct: 'Sumar % (precio)',
  round: 'Redondear (decimales)',
  prefix: 'Prefijo',
  suffix: 'Sufijo',
  concat: 'Concatenar',
  split: 'Tomar parte (split)',
  fx_convert: 'Convertir moneda',
  truthy_to: 'Convertir booleano a',
  empty_to: 'Si vacío usar',
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function autoDetectMapping(csvHeaders: string[], fields: ImportField[]): MappingState {
  const mapping: MappingState = {}
  csvHeaders.forEach((header, idx) => {
    const normalizedHeader = normalizeStr(header)
    const exactKey = fields.find(f => normalizeStr(f.key) === normalizedHeader)
    if (exactKey) { mapping[idx] = exactKey.key; return }
    const exactLabel = fields.find(f => normalizeStr(f.label) === normalizedHeader)
    if (exactLabel) { mapping[idx] = exactLabel.key; return }
    const partial = fields.find(f =>
      normalizedHeader.includes(normalizeStr(f.key)) ||
      normalizeStr(f.key).includes(normalizedHeader) ||
      normalizedHeader.includes(normalizeStr(f.label)) ||
      normalizeStr(f.label).includes(normalizedHeader)
    )
    if (partial) {
      const alreadyMapped = Object.values(mapping).includes(partial.key)
      if (!alreadyMapped) mapping[idx] = partial.key
    }
  })
  return mapping
}

function validateValue(value: string, field: ImportField): { valid: boolean; parsed: unknown } {
  if (!value && field.required) return { valid: false, parsed: null }
  if (!value) return { valid: true, parsed: null }
  switch (field.type) {
    case 'number': {
      const cleaned = value.replace(/\s/g, '').replace(',', '.')
      const num = Number(cleaned)
      if (isNaN(num)) return { valid: false, parsed: null }
      return { valid: true, parsed: num }
    }
    case 'boolean': {
      const lower = value.toLowerCase()
      if (['true', '1', 'si', 'yes', 'verdadero', 'v', 'sí'].includes(lower)) return { valid: true, parsed: true }
      if (['false', '0', 'no', 'falso', 'f'].includes(lower)) return { valid: true, parsed: false }
      return { valid: false, parsed: null }
    }
    case 'date': {
      const d = new Date(value)
      if (isNaN(d.getTime())) return { valid: false, parsed: null }
      return { valid: true, parsed: d.toISOString() }
    }
    default:
      return { valid: true, parsed: value.trim() }
  }
}

function validateStelOrderValue(value: string, fieldKey: string): { valid: boolean; parsed: unknown } {
  if (!value || value.trim() === '') return { valid: true, parsed: null }
  const trimmed = value.trim()
  const numericFields = ['price_eur', 'cost_eur', 'weight_kg', 'credit_limit',
    'specs.stock', 'specs.stock_min', 'specs.stock_max', 'specs.vat_sale',
    'specs.min_sale_price', 'specs.price_list_1', 'specs.price_list_2',
    'specs.price_list_3', 'specs.price_list_4', 'specs.price_list_5']
  if (numericFields.includes(fieldKey)) {
    const cleaned = trimmed.replace(/\s/g, '').replace(',', '.')
    const num = Number(cleaned)
    if (isNaN(num)) return { valid: true, parsed: trimmed }
    return { valid: true, parsed: num }
  }
  if (fieldKey === 'active' || fieldKey === 'surcharge') {
    const lower = trimmed.toLowerCase()
    if (['true', '1', 'si', 'yes', 'verdadero', 'v', 'sí'].includes(lower)) return { valid: true, parsed: true }
    if (['false', '0', 'no', 'falso', 'f'].includes(lower)) return { valid: true, parsed: false }
    return { valid: true, parsed: trimmed }
  }
  return { valid: true, parsed: trimmed }
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function ImportButton({
  targetTable,
  fields,
  onComplete,
  permission,
  label = 'Importar',
  className = '',
}: ImportButtonProps) {
  const { can, isSuper } = usePermissions()
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // States
  const [showModal, setShowModal] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<MappingState>({})
  const [colTransforms, setColTransforms] = useState<ColTransforms>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [fileName, setFileName] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)

  // Detección legacy StelOrder (mantenida por backward-compat) + nueva detección por profile
  const [stelDetection, setStelDetection] = useState<StelOrderDetection | null>(null)
  const [profileDetection, setProfileDetection] = useState<ProfileDetection | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('custom')

  // Modo de import (Fase 2): insert, update, upsert, sync, partial
  const [importMode, setImportMode] = useState<ImportMode>('upsert')
  const [partialFields, setPartialFields] = useState<string[]>([])
  const [syncCategoryFilter, setSyncCategoryFilter] = useState<string>('')
  const [syncDryRunDone, setSyncDryRunDone] = useState(false)

  // Dry-run
  const [dryRun, setDryRun] = useState(false)
  const [dryRunReport, setDryRunReport] = useState<{
    insert: number
    update: number
    skip: number
    fail: number
    syncDescat: number
    sampleUpdates: Array<{ keyValue: string; changes: Record<string, { from: unknown; to: unknown }> }>
    failures: Array<{ row: number; error: string }>
  } | null>(null)

  // Tab: subir / pegar
  const [inputTab, setInputTab] = useState<'upload' | 'paste'>('upload')
  const [pastedText, setPastedText] = useState('')

  // Job log + reversión
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const [reverting, setReverting] = useState(false)

  // Plantillas
  const [templates, setTemplates] = useState<ImportTemplate[]>([])
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplDesc, setTplDesc] = useState('')
  const [tplShared, setTplShared] = useState(false)
  const [tplDefault, setTplDefault] = useState(false)

  // Transforms editor
  const [editingTransformsCol, setEditingTransformsCol] = useState<number | null>(null)

  // Fuzzy dups
  const [showDups, setShowDups] = useState(false)
  const [findingDups, setFindingDups] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([])
  const [dupDecisions, setDupDecisions] = useState<Record<number, DupDecision>>({})

  // ─── Cargar plantillas al abrir el modal ───
  const reloadTemplates = useCallback(async () => {
    const t = await listTemplates(targetTable)
    setTemplates(t)
  }, [targetTable])

  // ─── File handler ───
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setResults(null)
    setValidationErrors([])
    setProgress(0)
    setImporting(false)
    setStelDetection(null)
    setProfileDetection(null)
    setColTransforms({})
    setLoadingFile(true)

    const ext = file.name.split('.').pop()?.toLowerCase()
    const isExcel = ext === 'xlsx' || ext === 'xls'
    const isCSV = ext === 'csv'

    if (!isExcel && !isCSV) {
      addToast({ type: 'warning', title: 'Formato no soportado. Usa archivos CSV (.csv) o Excel (.xlsx).' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      setLoadingFile(false)
      return
    }

    try {
      let headers: string[]
      let rows: string[][]

      if (isExcel) {
        const parsed = await parseXLSX(file)
        headers = parsed.headers
        rows = parsed.rows
      } else {
        const text = await readFileAsText(file)
        const parsed = parseCSV(text)
        headers = parsed.headers
        rows = parsed.rows
      }

      if (headers.length === 0 || rows.length === 0) {
        addToast({ type: 'error', title: 'El archivo esta vacio o no tiene datos validos' })
        if (fileInputRef.current) fileInputRef.current.value = ''
        setLoadingFile(false)
        return
      }

      setCsvHeaders(headers)
      setCsvRows(rows)
      setFileName(file.name)

      // Detección legacy StelOrder (compat)
      const stelDet = detectStelOrderFormat(headers, targetTable)
      setStelDetection(stelDet)

      // Nueva detección por profile (sólo si target es tt_products|tt_clients|tt_suppliers)
      const isProfilable = targetTable === 'tt_products' || targetTable === 'tt_clients' || targetTable === 'tt_suppliers'
      const profDet = isProfilable ? detectProfile(headers, targetTable as TargetTable) : null
      setProfileDetection(profDet)

      if (profDet) {
        setSelectedProfileId(profDet.profile.id)
        applyProfileMapping(profDet.profile.id, headers)
      } else if (stelDet.isStelOrder && Object.keys(stelDet.mapping).length > 0) {
        setSelectedProfileId('stelorder')
        setMapping(stelDet.mapping)
      } else {
        setSelectedProfileId('custom')
        setMapping(autoDetectMapping(headers, fields))
      }

      void reloadTemplates()
      setShowModal(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al leer el archivo'
      addToast({ type: 'error', title: msg })
    }

    setLoadingFile(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    // applyProfileMapping definida abajo — referenciamos por closure; React usa la última.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, addToast, targetTable, reloadTemplates])

  // ─── Aplicar un profile al mapping (re-arma colTransforms y mapping) ───
  const applyProfileMapping = useCallback((profileId: string, headers: string[] = csvHeaders) => {
    if (profileId === 'custom') {
      setMapping(autoDetectMapping(headers, fields))
      setColTransforms({})
      return
    }
    const profile = getProfile(profileId)
    if (!profile) return
    const isProfilable = targetTable === 'tt_products' || targetTable === 'tt_clients' || targetTable === 'tt_suppliers'
    if (!isProfilable) return
    const fmList = profile.mappings[targetTable as TargetTable]
    if (!fmList) return

    const newMapping: MappingState = {}
    const newTransforms: ColTransforms = {}
    headers.forEach((header, idx) => {
      const norm = header.trim().toLowerCase()
      const fm = fmList.find(f => f.source.trim().toLowerCase() === norm)
      if (fm) {
        newMapping[idx] = fm.target
        if (fm.transforms && fm.transforms.length > 0) {
          newTransforms[idx] = [...fm.transforms]
        }
      }
    })
    setMapping(newMapping)
    setColTransforms(newTransforms)
  }, [csvHeaders, fields, targetTable])

  // ─── Validate all ───
  const validateAll = useCallback((): string[] => {
    const errors: string[] = []
    const isStel = stelDetection?.isStelOrder || selectedProfileId !== 'custom'

    if (!isStel) {
      const mappedKeys = new Set(Object.values(mapping))
      for (const field of fields) {
        if (field.required && !mappedKeys.has(field.key)) {
          errors.push(`El campo requerido "${field.label}" no esta mapeado a ninguna columna`)
        }
      }
    }

    if (errors.length > 0) return errors

    const sampleRows = csvRows.slice(0, 100)
    let typeErrors = 0
    for (let rowIdx = 0; rowIdx < sampleRows.length; rowIdx++) {
      const row = sampleRows[rowIdx]
      for (const [colIdxStr, fieldKey] of Object.entries(mapping)) {
        const colIdx = Number(colIdxStr)
        const field = fields.find(f => f.key === fieldKey)
        if (!field && !isStel) continue
        const value = row[colIdx] || ''
        if (!value) continue

        if (isStel) {
          const { valid } = validateStelOrderValue(value, fieldKey)
          if (!valid) {
            typeErrors++
            if (typeErrors <= 5) errors.push(`Fila ${rowIdx + 2}: campo "${fieldKey}" tiene un valor invalido: "${value.substring(0, 30)}"`)
          }
        } else if (field) {
          const { valid } = validateValue(value, field)
          if (!valid) {
            typeErrors++
            if (typeErrors <= 5) errors.push(`Fila ${rowIdx + 2}: "${field.label}" tiene un valor invalido: "${value.substring(0, 30)}"`)
          }
        }
      }
    }
    if (typeErrors > 5) errors.push(`... y ${typeErrors - 5} errores de validacion mas`)
    return errors
  }, [mapping, csvRows, fields, stelDetection, selectedProfileId])

  // ─── Construye record desde row ───
  const buildRecordFromRow = useCallback((row: string[], rowIdx: number): { record: Record<string, unknown> | null; error: string | null } => {
    const isStel = stelDetection?.isStelOrder || selectedProfileId !== 'custom'
    const record: Record<string, unknown> = {}

    for (const [colIdxStr, fieldKey] of Object.entries(mapping)) {
      const colIdx = Number(colIdxStr)
      let rawValue: unknown = row[colIdx] || ''

      // Aplicar transforms si hay para esta columna
      const steps = colTransforms[colIdx]
      if (steps && steps.length > 0 && rawValue !== '') {
        rawValue = applyTransforms(rawValue, steps)
      }

      if (isStel) {
        const strValue = typeof rawValue === 'string' ? rawValue : (rawValue == null ? '' : String(rawValue))
        // Si transforms ya devolvió number, lo conservamos
        if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
          record[fieldKey] = rawValue
        } else {
          const { parsed } = validateStelOrderValue(strValue, fieldKey)
          if (parsed !== null) record[fieldKey] = parsed
        }
      } else {
        const field = fields.find(f => f.key === fieldKey)
        if (!field) continue
        const strValue = typeof rawValue === 'string' ? rawValue : (rawValue == null ? '' : String(rawValue))
        if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
          record[fieldKey] = rawValue
          continue
        }
        const { valid, parsed } = validateValue(strValue, field)
        if (!valid && field.required) {
          return { record: null, error: `Fila ${rowIdx + 2}: "${field.label}" inválido` }
        }
        if (parsed !== null) record[fieldKey] = parsed
      }
    }

    if (Object.keys(record).length === 0) return { record: null, error: null }

    let expanded = expandDotNotation(record)
    if (targetTable === 'tt_products') {
      expanded = postProcessProductRecord(expanded)
    }
    return { record: expanded, error: null }
  }, [mapping, fields, stelDetection, selectedProfileId, targetTable, colTransforms])

  // ─── Aplicar partial_fields filter ───
  const applyPartialFilter = useCallback((rec: Record<string, unknown>): Record<string, unknown> => {
    if (importMode !== 'partial' || partialFields.length === 0) return rec
    const upsertKey = UPSERT_KEYS[targetTable]
    const out: Record<string, unknown> = {}
    if (upsertKey && rec[upsertKey] !== undefined) out[upsertKey] = rec[upsertKey]
    for (const f of partialFields) {
      if (rec[f] !== undefined) out[f] = rec[f]
    }
    return out
  }, [importMode, partialFields, targetTable])

  // ─── DRY-RUN ───
  const handleDryRun = useCallback(async () => {
    const errors = validateAll()
    if (errors.length > 0) { setValidationErrors(errors); return }
    setValidationErrors([])
    setImporting(true)
    setProgress(0)

    const supabase = createClient()
    const upsertKey = UPSERT_KEYS[targetTable]
    const totalRows = csvRows.length
    let insert = 0, update = 0, skip = 0, fail = 0, syncDescat = 0
    const sampleUpdates: Array<{ keyValue: string; changes: Record<string, { from: unknown; to: unknown }> }> = []
    const failures: Array<{ row: number; error: string }> = []

    const incomingKeys = new Set<string>()

    for (let i = 0; i < totalRows; i++) {
      const decision = dupDecisions[i]
      if (decision === 'skip') { skip++; continue }

      const built = buildRecordFromRow(csvRows[i], i)
      const buildErr = built.error
      let record = built.record
      if (buildErr) { fail++; failures.push({ row: i + 2, error: buildErr }); continue }
      if (!record) { skip++; continue }

      // Si la decisión de duplicado fue mergear: forzar upsert key al SKU del match
      if (decision && typeof decision === 'object' && 'merge_with_sku' in decision && upsertKey) {
        record[upsertKey] = decision.merge_with_sku
      }

      record = applyPartialFilter(record)
      const keyValue = upsertKey ? record[upsertKey] : null
      if (typeof keyValue === 'string') incomingKeys.add(keyValue)

      const wantUpsert = importMode === 'upsert' || importMode === 'sync' || importMode === 'partial'
      const wantUpdateOnly = importMode === 'update'
      const wantInsertOnly = importMode === 'insert'

      if ((wantUpsert || wantUpdateOnly) && upsertKey && keyValue) {
        const { data: existing, error: readErr } = await supabase
          .from(targetTable).select('*').eq(upsertKey, keyValue).limit(1)
        if (readErr) { fail++; failures.push({ row: i + 2, error: readErr.message }); continue }

        if (existing && existing.length > 0) {
          update++
          if (sampleUpdates.length < 8) {
            const before = existing[0] as Record<string, unknown>
            const changes: Record<string, { from: unknown; to: unknown }> = {}
            for (const [k, v] of Object.entries(record)) {
              if (k === 'id') continue
              if (JSON.stringify(before[k]) !== JSON.stringify(v)) {
                changes[k] = { from: before[k] ?? null, to: v }
              }
            }
            if (Object.keys(changes).length > 0) sampleUpdates.push({ keyValue: String(keyValue), changes })
          }
        } else {
          if (wantUpdateOnly) { skip++ } else { insert++ }
        }
      } else if (wantInsertOnly) {
        insert++
      } else {
        insert++
      }

      if (i % 25 === 0) setProgress(Math.min(100, Math.round((i / totalRows) * 100)))
    }

    // Si modo sync: contar los que quedarían descatalogados
    if (importMode === 'sync' && upsertKey) {
      let q = supabase.from(targetTable).select(upsertKey + ', id', { count: 'exact', head: false }).limit(10000)
      if (syncCategoryFilter && targetTable === 'tt_products') {
        q = q.eq('category', syncCategoryFilter)
      }
      const { data: universe } = await q
      if (universe) {
        for (const row of universe as unknown as Array<Record<string, unknown>>) {
          const k = row[upsertKey]
          if (typeof k === 'string' && !incomingKeys.has(k)) syncDescat++
        }
      }
    }

    setProgress(100)
    setImporting(false)
    setDryRunReport({ insert, update, skip, fail, syncDescat, sampleUpdates, failures })
    if (importMode === 'sync') setSyncDryRunDone(true)
  }, [validateAll, csvRows, buildRecordFromRow, targetTable, importMode, dupDecisions, applyPartialFilter, syncCategoryFilter])

  // ─── Import real ───
  const handleImport = useCallback(async () => {
    const errors = validateAll()
    if (errors.length > 0) { setValidationErrors(errors); return }

    if (dryRun) { await handleDryRun(); return }

    if (importMode === 'sync' && !syncDryRunDone) {
      addToast({ type: 'warning', title: 'Modo sync: corré el dry-run primero para confirmar el alcance.' })
      return
    }

    setValidationErrors([])
    setImporting(true)
    setProgress(0)
    setDryRunReport(null)

    const supabase = createClient()
    const importResults: ImportResults = { inserted: 0, updated: 0, skipped: 0, errors: [] }
    const BATCH_SIZE = 50
    const totalRows = csvRows.length
    const upsertKey = UPSERT_KEYS[targetTable]

    const jobId = await createImportJob({
      target_table: targetTable,
      file_name: fileName || null,
      mode: 'import',
      upsert_mode: importMode === 'upsert' || importMode === 'sync' || importMode === 'partial',
      total_rows: totalRows,
    })
    setLastJobId(jobId)
    const rowLog: ImportJobRow[] = []
    const incomingKeys = new Set<string>()

    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
      const batch = csvRows.slice(i, i + BATCH_SIZE)
      for (let bIdx = 0; bIdx < batch.length; bIdx++) {
        const rowIdx = i + bIdx
        const decision = dupDecisions[rowIdx]
        if (decision === 'skip') {
          importResults.skipped++
          rowLog.push({ row_index: rowIdx, action: 'skip', entity_id: null, before: null, after: null, error: 'Saltado por dedup' })
          continue
        }

        const built = buildRecordFromRow(batch[bIdx], rowIdx)
        const buildErr = built.error
        let record = built.record
        if (buildErr) {
          importResults.errors.push(buildErr)
          importResults.skipped++
          rowLog.push({ row_index: rowIdx, action: 'fail', entity_id: null, before: null, after: null, error: buildErr })
          continue
        }
        if (!record) {
          importResults.skipped++
          rowLog.push({ row_index: rowIdx, action: 'skip', entity_id: null, before: null, after: null, error: null })
          continue
        }

        if (decision && typeof decision === 'object' && 'merge_with_sku' in decision && upsertKey) {
          record[upsertKey] = decision.merge_with_sku
        }
        record = applyPartialFilter(record)
        const keyValue = upsertKey ? record[upsertKey] : null
        if (typeof keyValue === 'string') incomingKeys.add(keyValue)

        const wantUpsert = importMode === 'upsert' || importMode === 'sync' || importMode === 'partial'
        const wantUpdateOnly = importMode === 'update'
        const wantInsertOnly = importMode === 'insert'

        if ((wantUpsert || wantUpdateOnly) && upsertKey && keyValue) {
          const { data: existing } = await supabase.from(targetTable).select('*').eq(upsertKey, keyValue).limit(1)
          if (existing && existing.length > 0) {
            const before = existing[0] as Record<string, unknown>
            const entityId = (before.id as string) || null
            const { error: updateError } = await supabase.from(targetTable).update(record).eq(upsertKey, keyValue)
            if (updateError) {
              importResults.errors.push(`Error actualizando ${upsertKey}=${keyValue}: ${updateError.message?.substring(0, 80)}`)
              importResults.skipped++
              rowLog.push({ row_index: rowIdx, action: 'fail', entity_id: entityId, before, after: record, error: updateError.message || null })
            } else {
              importResults.updated++
              rowLog.push({ row_index: rowIdx, action: 'update', entity_id: entityId, before, after: record, error: null })
            }
          } else {
            if (wantUpdateOnly) {
              importResults.skipped++
              rowLog.push({ row_index: rowIdx, action: 'skip', entity_id: null, before: null, after: record, error: 'No existe (modo update)' })
            } else {
              const { data: inserted, error: insertError } = await supabase.from(targetTable).insert(record).select('id').single()
              if (insertError) {
                if (insertError.code === '23505') {
                  importResults.skipped++
                  rowLog.push({ row_index: rowIdx, action: 'skip', entity_id: null, before: null, after: record, error: 'Duplicado' })
                } else {
                  importResults.errors.push(`Error insertando: ${insertError.message?.substring(0, 80)}`)
                  importResults.skipped++
                  rowLog.push({ row_index: rowIdx, action: 'fail', entity_id: null, before: null, after: record, error: insertError.message || null })
                }
              } else {
                importResults.inserted++
                const newId = (inserted as { id: string } | null)?.id || null
                rowLog.push({ row_index: rowIdx, action: 'insert', entity_id: newId, before: null, after: record, error: null })
              }
            }
          }
        } else if (wantInsertOnly || (!wantUpdateOnly && !upsertKey)) {
          const { data: inserted, error } = await supabase.from(targetTable).insert(record).select('id').single()
          if (error) {
            if (error.code === '23505') {
              importResults.skipped++
              rowLog.push({ row_index: rowIdx, action: 'skip', entity_id: null, before: null, after: record, error: 'Duplicado' })
            } else {
              importResults.errors.push(`Error: ${error.message?.substring(0, 80)}`)
              importResults.skipped++
              rowLog.push({ row_index: rowIdx, action: 'fail', entity_id: null, before: null, after: record, error: error.message || null })
            }
          } else {
            importResults.inserted++
            const newId = (inserted as { id: string } | null)?.id || null
            rowLog.push({ row_index: rowIdx, action: 'insert', entity_id: newId, before: null, after: record, error: null })
          }
        }
      }
      setProgress(Math.min(100, Math.round(((i + batch.length) / totalRows) * 100)))
    }

    // Modo sync: descatalogar los que no vinieron
    if (importMode === 'sync' && upsertKey) {
      let q = supabase.from(targetTable).select('id, ' + upsertKey).limit(10000)
      if (syncCategoryFilter && targetTable === 'tt_products') {
        q = q.eq('category', syncCategoryFilter)
      }
      const { data: universe } = await q
      if (universe) {
        for (const row of universe as unknown as Array<Record<string, unknown>>) {
          const k = row[upsertKey]
          const id = row.id
          if (typeof k === 'string' && !incomingKeys.has(k) && typeof id === 'string') {
            const patch: Record<string, unknown> = { active: false }
            if (targetTable === 'tt_products') patch.lifecycle_status = 'descatalogado'
            const { data: before } = await supabase.from(targetTable).select('*').eq('id', id).single()
            const { error: descErr } = await supabase.from(targetTable).update(patch).eq('id', id)
            if (!descErr) {
              importResults.updated++
              rowLog.push({ row_index: -1, action: 'update', entity_id: id, before: (before as Record<string, unknown>) || null, after: patch, error: null })
            }
          }
        }
      }
    }

    setImporting(false)
    setProgress(100)
    setResults(importResults)

    if (jobId) {
      const failed = importResults.errors.length
      const finalStatus = failed > totalRows / 2 ? 'failed' : 'completed'
      await updateImportJob(jobId, {
        status: finalStatus,
        inserted: importResults.inserted,
        updated: importResults.updated,
        skipped: importResults.skipped,
        failed,
        row_log: rowLog,
        completed_at: new Date().toISOString(),
      })
    }

    onComplete?.(importResults)
    if (importResults.inserted > 0 || importResults.updated > 0) {
      addToast({
        type: 'success',
        title: `Importación: ${importResults.inserted} insertados, ${importResults.updated} actualizados`,
      })
    }
  }, [validateAll, dryRun, handleDryRun, csvRows, buildRecordFromRow, targetTable, fileName, importMode, syncDryRunDone, dupDecisions, applyPartialFilter, syncCategoryFilter, onComplete, addToast])

  // ─── Revertir ───
  const handleRevertLastJob = useCallback(async () => {
    if (!lastJobId) return
    setReverting(true)
    try {
      const res = await revertImportJob(lastJobId)
      addToast({
        type: res.failed > 0 ? 'warning' : 'success',
        title: `Reversión: ${res.reverted} ok${res.failed > 0 ? `, ${res.failed} fallaron` : ''}`,
      })
      setLastJobId(null)
      onComplete?.({ inserted: 0, updated: 0, skipped: 0, errors: [] })
    } catch (e) {
      addToast({ type: 'error', title: 'Error revirtiendo', message: (e as Error).message })
    } finally {
      setReverting(false)
    }
  }, [lastJobId, addToast, onComplete])

  // ─── Close & reset ───
  const handleClose = useCallback(() => {
    setShowModal(false)
    setCsvHeaders([])
    setCsvRows([])
    setMapping({})
    setColTransforms({})
    setValidationErrors([])
    setImporting(false)
    setProgress(0)
    setResults(null)
    setFileName('')
    setStelDetection(null)
    setProfileDetection(null)
    setSelectedProfileId('custom')
    setLoadingFile(false)
    setDryRunReport(null)
    setLastJobId(null)
    setPastedText('')
    setInputTab('upload')
    setImportMode('upsert')
    setPartialFields([])
    setSyncCategoryFilter('')
    setSyncDryRunDone(false)
    setDuplicates([])
    setDupDecisions({})
    setShowSaveTpl(false)
    setEditingTransformsCol(null)
  }, [])

  // ─── Pegado ───
  const handlePasteProcess = useCallback(() => {
    if (!pastedText.trim()) { addToast({ type: 'warning', title: 'Pegá los datos primero' }); return }
    const firstLine = pastedText.split(/\r?\n/)[0] || ''
    const hasTab = firstLine.includes('\t')
    const sep = hasTab ? '\t' : (firstLine.includes(';') ? ';' : ',')

    let textToParse = pastedText
    if (sep === '\t') {
      textToParse = pastedText.split(/\r?\n/).map(line =>
        line.split('\t').map(c => {
          if (c.includes(',') || c.includes('"') || c.includes('\n')) {
            return '"' + c.replace(/"/g, '""') + '"'
          }
          return c
        }).join(',')
      ).join('\n')
    } else if (sep === ';') {
      textToParse = pastedText.replace(/;/g, ',')
    }

    try {
      const parsed = parseCSV(textToParse)
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        addToast({ type: 'error', title: 'No pude parsear los datos pegados' })
        return
      }
      setCsvHeaders(parsed.headers)
      setCsvRows(parsed.rows)
      setFileName('(pegado desde portapapeles)')
      const stelDet = detectStelOrderFormat(parsed.headers, targetTable)
      setStelDetection(stelDet)
      const isProfilable = targetTable === 'tt_products' || targetTable === 'tt_clients' || targetTable === 'tt_suppliers'
      const profDet = isProfilable ? detectProfile(parsed.headers, targetTable as TargetTable) : null
      setProfileDetection(profDet)
      if (profDet) {
        setSelectedProfileId(profDet.profile.id)
        applyProfileMapping(profDet.profile.id, parsed.headers)
      } else if (stelDet.isStelOrder && Object.keys(stelDet.mapping).length > 0) {
        setSelectedProfileId('stelorder')
        setMapping(stelDet.mapping)
      } else {
        setSelectedProfileId('custom')
        setMapping(autoDetectMapping(parsed.headers, fields))
      }
      void reloadTemplates()
      setShowModal(true)
    } catch (e) {
      addToast({ type: 'error', title: 'Error parseando', message: (e as Error).message })
    }
  }, [pastedText, addToast, targetTable, fields, applyProfileMapping, reloadTemplates])

  // ─── Mapping change ───
  const updateMapping = useCallback((colIdx: number, fieldKey: string) => {
    setMapping(prev => {
      const next = { ...prev }
      if (fieldKey === '') delete next[colIdx]
      else next[colIdx] = fieldKey
      return next
    })
    setValidationErrors([])
  }, [])

  // ─── Combined fields (para selects) ───
  const allFields = useMemo<ImportField[]>(() => {
    const out: ImportField[] = [...fields]
    const existingKeys = new Set(fields.map(f => f.key))

    if (stelDetection?.isStelOrder) {
      const mappedValues = Object.values(stelDetection.mapping)
      for (const fieldKey of mappedValues) {
        if (!existingKeys.has(fieldKey) && !fieldKey.includes('.')) {
          out.push({ key: fieldKey, label: fieldKey })
          existingKeys.add(fieldKey)
        }
      }
    }

    // Targets del profile actual
    const isProfilable = targetTable === 'tt_products' || targetTable === 'tt_clients' || targetTable === 'tt_suppliers'
    if (isProfilable && selectedProfileId !== 'custom') {
      const p = getProfile(selectedProfileId)
      const fmList = p?.mappings[targetTable as TargetTable]
      if (fmList) {
        for (const fm of fmList) {
          if (!existingKeys.has(fm.target) && !fm.target.includes('.')) {
            out.push({ key: fm.target, label: fm.target })
            existingKeys.add(fm.target)
          }
        }
      }
    }
    return out
  }, [fields, stelDetection, selectedProfileId, targetTable])

  // ─── Cargar plantilla ───
  const handleLoadTemplate = useCallback(async (tplId: string) => {
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) return

    if (tpl.profile_id) setSelectedProfileId(tpl.profile_id)
    setImportMode(tpl.options.mode)
    setPartialFields(tpl.options.partial_fields || [])
    setSyncCategoryFilter(tpl.options.sync_filter || '')
    if (tpl.options.dry_run_default) setDryRun(true)

    // Re-armar mapping basado en csvHeaders + tpl.column_mapping (csv_col → target_field)
    const newMapping: MappingState = {}
    csvHeaders.forEach((header, idx) => {
      const target = tpl.column_mapping[header]
      if (target) newMapping[idx] = target
    })
    setMapping(newMapping)

    // Re-armar transforms
    const newTransforms: ColTransforms = {}
    for (const block of tpl.transforms || []) {
      const idx = csvHeaders.findIndex(h => h === block.column)
      if (idx >= 0) newTransforms[idx] = block.steps
    }
    setColTransforms(newTransforms)

    void bumpUsage(tpl.id)
    addToast({ type: 'success', title: `Plantilla "${tpl.name}" cargada` })
  }, [templates, csvHeaders, addToast])

  // ─── Guardar plantilla ───
  const handleSaveTemplate = useCallback(async () => {
    if (!tplName.trim()) { addToast({ type: 'warning', title: 'Poné un nombre' }); return }
    // column_mapping: csv_col_header → target_field
    const column_mapping: Record<string, string> = {}
    for (const [colIdxStr, target] of Object.entries(mapping)) {
      const idx = Number(colIdxStr)
      const header = csvHeaders[idx]
      if (header) column_mapping[header] = target
    }
    const transforms: TemplateTransformBlock[] = []
    for (const [colIdxStr, steps] of Object.entries(colTransforms)) {
      const idx = Number(colIdxStr)
      const header = csvHeaders[idx]
      if (header && steps && steps.length > 0) transforms.push({ column: header, steps })
    }

    const id = await saveTemplate({
      company_id: null,
      name: tplName.trim(),
      description: tplDesc.trim() || null,
      target_table: targetTable,
      profile_id: selectedProfileId === 'custom' ? null : selectedProfileId,
      column_mapping,
      transforms,
      options: {
        mode: importMode,
        key_column: UPSERT_KEYS[targetTable] || '',
        partial_fields: partialFields,
        dry_run_default: dryRun,
        sync_filter: syncCategoryFilter,
      },
      is_shared: tplShared,
      is_default: tplDefault,
    })
    if (id) {
      addToast({ type: 'success', title: 'Plantilla guardada' })
      setShowSaveTpl(false)
      setTplName(''); setTplDesc(''); setTplShared(false); setTplDefault(false)
      void reloadTemplates()
    } else {
      addToast({ type: 'error', title: 'No se pudo guardar' })
    }
  }, [tplName, tplDesc, mapping, csvHeaders, colTransforms, targetTable, selectedProfileId, importMode, partialFields, dryRun, syncCategoryFilter, tplShared, tplDefault, addToast, reloadTemplates])

  // ─── Detectar duplicados ───
  const handleFindDuplicates = useCallback(async () => {
    setFindingDups(true)
    try {
      // Convertir csvRows a Record<string,string>[] usando csvHeaders + mapping (target → csv_header_index → header_name)
      const rowsAsObj: Array<Record<string, string>> = csvRows.map(r => {
        const obj: Record<string, string> = {}
        csvHeaders.forEach((h, idx) => { obj[h] = r[idx] || '' })
        return obj
      })
      // Mapping para fuzzy: csv_header → target
      const targetMapping: Record<string, string> = {}
      for (const [colIdxStr, target] of Object.entries(mapping)) {
        const idx = Number(colIdxStr)
        const h = csvHeaders[idx]
        if (h) targetMapping[h] = target
      }
      const dups = await findDuplicateCandidates(rowsAsObj, targetMapping, { threshold: 0.75, max_per_row: 3 })
      setDuplicates(dups)
      const newDecisions: Record<number, DupDecision> = {}
      for (const d of dups) newDecisions[d.rowIndex] = 'pending'
      setDupDecisions(newDecisions)
      setShowDups(true)
      addToast({ type: dups.length > 0 ? 'warning' : 'success', title: `${dups.length} candidatos a duplicado` })
    } catch (e) {
      addToast({ type: 'error', title: 'Error detectando duplicados', message: (e as Error).message })
    } finally {
      setFindingDups(false)
    }
  }, [csvRows, csvHeaders, mapping, addToast])

  // ─── Transforms editor handlers ───
  const updateTransformStep = useCallback((colIdx: number, stepIdx: number, patch: Partial<TransformStep>) => {
    setColTransforms(prev => {
      const list = prev[colIdx] ? [...prev[colIdx]] : []
      list[stepIdx] = { ...list[stepIdx], ...patch }
      return { ...prev, [colIdx]: list }
    })
  }, [])
  const addTransformStep = useCallback((colIdx: number, op: TransformOp) => {
    setColTransforms(prev => {
      const list = prev[colIdx] ? [...prev[colIdx]] : []
      list.push({ op })
      return { ...prev, [colIdx]: list }
    })
  }, [])
  const removeTransformStep = useCallback((colIdx: number, stepIdx: number) => {
    setColTransforms(prev => {
      const list = prev[colIdx] ? [...prev[colIdx]] : []
      list.splice(stepIdx, 1)
      const next = { ...prev }
      if (list.length === 0) delete next[colIdx]
      else next[colIdx] = list
      return next
    })
  }, [])
  const moveTransformStep = useCallback((colIdx: number, stepIdx: number, dir: -1 | 1) => {
    setColTransforms(prev => {
      const list = prev[colIdx] ? [...prev[colIdx]] : []
      const target = stepIdx + dir
      if (target < 0 || target >= list.length) return prev
      const tmp = list[stepIdx]
      list[stepIdx] = list[target]
      list[target] = tmp
      return { ...prev, [colIdx]: list }
    })
  }, [])

  // ─── Preview rows ───
  const previewRows = csvRows.slice(0, 10)
  const editingSteps = editingTransformsCol !== null ? (colTransforms[editingTransformsCol] || []) : []
  const previewBefore = editingTransformsCol !== null && csvRows[0] ? (csvRows[0][editingTransformsCol] || '') : ''
  const previewAfter = editingTransformsCol !== null
    ? applyTransforms(previewBefore, editingSteps)
    : ''

  // Permission check (después de TODOS los hooks — anti-bug "useCallback after return")
  if (permission && !can(permission) && !can('import_data') && !isSuper) return null

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className={`inline-flex items-stretch rounded-lg overflow-hidden border border-[#2A3040] bg-[#141820] ${className}`}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loadingFile}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#9CA3AF] hover:bg-[#1C2230] hover:text-[#FF6600] transition-all disabled:opacity-50"
        >
          {loadingFile ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {loadingFile ? 'Cargando...' : label}
        </button>
        <button
          onClick={() => setInputTab('paste')}
          title="Pegar datos desde Excel/portapapeles"
          className="flex items-center gap-1.5 px-2.5 text-xs font-medium text-[#6B7280] hover:bg-[#1C2230] hover:text-[#FF6600] transition-all border-l border-[#2A3040]"
        >
          <Clipboard size={13} />
        </button>
      </div>

      {/* Modal pegado */}
      {inputTab === 'paste' && !showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setInputTab('upload'); setPastedText('') }} />
          <div className="relative w-[min(92vw,720px)] bg-[#141820] border border-[#1E2330] rounded-2xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E2330]">
              <div className="flex items-center gap-2">
                <Clipboard size={16} className="text-[#FF6600]" />
                <strong className="text-sm text-[#F0F2F5]">Pegar datos</strong>
              </div>
              <button onClick={() => { setInputTab('upload'); setPastedText('') }} className="text-[#6B7280] hover:text-[#F0F2F5]">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-[#6B7280]">
                Pegá los datos copiados desde Excel, Google Sheets o un CSV. Auto-detecta separador.
              </p>
              <textarea
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="SKU	Nombre	Marca&#10;ABC-123	Llave torque	Tohnichi"
                rows={12}
                className="w-full rounded-lg bg-[#0F1218] border border-[#1E2330] px-3 py-2 text-xs font-mono text-[#F0F2F5] placeholder:text-[#4B5563] focus:outline-none focus:border-[#FF6600]"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setInputTab('upload'); setPastedText('') }} className="px-3 py-1.5 rounded-lg text-xs text-[#9CA3AF] hover:text-[#F0F2F5]">Cancelar</button>
                <button onClick={handlePasteProcess} disabled={!pastedText.trim()} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#FF6600] text-white hover:bg-[#FF8833] disabled:opacity-50">Procesar datos</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL principal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!importing ? handleClose : undefined} />
          <div className="relative w-full mx-4 max-w-[95vw] bg-[#141820] border border-[#1E2330] rounded-2xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2330]">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-[#F0F2F5]">Importar datos</h2>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {isXLSXFile({ name: fileName } as File) ? <FileSpreadsheet size={12} className="inline mr-1 text-green-400" /> : <FileText size={12} className="inline mr-1" />}
                    {fileName} &mdash; {csvRows.length} filas
                  </p>
                </div>
                {profileDetection && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <CheckCircle size={14} className="text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">
                      Detectado: {profileDetection.profile.label}
                    </span>
                    <span className="text-[10px] text-emerald-500/70 ml-1">
                      ({profileDetection.matchCount}/{profileDetection.totalSignatureCols} cols, {Math.round(profileDetection.confidence * 100)}%)
                    </span>
                  </div>
                )}
              </div>
              {!importing && (
                <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-[#1E2330] text-[#6B7280] hover:text-[#F0F2F5]">
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">

              {/* ─── Profile + Plantilla bar ─── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#1C2230] rounded-lg p-3">
                  <label className="block text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">Profile</label>
                  <select
                    value={selectedProfileId}
                    onChange={e => { setSelectedProfileId(e.target.value); applyProfileMapping(e.target.value) }}
                    className="w-full bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5] focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="custom">Personalizado (auto)</option>
                    {PROFILES.map(p => (
                      <option key={p.id} value={p.id}>{p.label} — {p.description.split('.')[0]}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-[#1C2230] rounded-lg p-3">
                  <label className="block text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">Plantilla</label>
                  <div className="flex gap-1">
                    <select
                      value=""
                      onChange={e => { if (e.target.value) void handleLoadTemplate(e.target.value) }}
                      className="flex-1 bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5] focus:outline-none focus:border-[#FF6600]"
                    >
                      <option value="">— Cargar plantilla —</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' ★' : ''} ({t.use_count} usos)</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowSaveTpl(true)}
                      className="px-2 py-1.5 rounded-lg bg-[#FF6600]/10 border border-[#FF6600]/30 text-[#FF6600] hover:bg-[#FF6600]/20"
                      title="Guardar como plantilla"
                    >
                      <Save size={13} />
                    </button>
                  </div>
                </div>

                <div className="bg-[#1C2230] rounded-lg p-3">
                  <label className="block text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">Modo de import</label>
                  <select
                    value={importMode}
                    onChange={e => { setImportMode(e.target.value as ImportMode); setSyncDryRunDone(false) }}
                    className="w-full bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5] focus:outline-none focus:border-[#FF6600]"
                  >
                    <option value="insert">Insert — solo nuevos</option>
                    <option value="update">Update — solo existentes</option>
                    <option value="upsert">Upsert — crear + actualizar</option>
                    <option value="sync">Sync — + descatalogar faltantes</option>
                    <option value="partial">Partial — solo campos elegidos</option>
                  </select>
                </div>
              </div>

              {/* Modo sync: filtro universo */}
              {importMode === 'sync' && (
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <strong className="text-xs text-amber-300">Modo sync — descatalogará lo que no esté en el archivo</strong>
                  </div>
                  {targetTable === 'tt_products' && (
                    <input
                      type="text"
                      placeholder="Filtro (categoría, opcional). Vacío = todos los activos."
                      value={syncCategoryFilter}
                      onChange={e => { setSyncCategoryFilter(e.target.value); setSyncDryRunDone(false) }}
                      className="w-full bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5] focus:outline-none focus:border-[#FF6600]"
                    />
                  )}
                  <p className="text-[10px] text-amber-200/80">
                    Tenés que correr el dry-run primero para ver el alcance. Si más del 10% del universo se descatalogaría, te lo vamos a marcar en rojo.
                  </p>
                </div>
              )}

              {/* Modo partial: lista de campos */}
              {importMode === 'partial' && (
                <div className="bg-blue-500/5 border border-blue-500/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={14} className="text-blue-400" />
                    <strong className="text-xs text-blue-300">Modo partial — tildá qué campos actualizar</strong>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                    {Array.from(new Set(Object.values(mapping))).map(fieldKey => (
                      <label key={fieldKey} className="flex items-center gap-2 text-xs text-[#F0F2F5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={partialFields.includes(fieldKey)}
                          onChange={e => {
                            if (e.target.checked) setPartialFields([...partialFields, fieldKey])
                            else setPartialFields(partialFields.filter(f => f !== fieldKey))
                          }}
                          className="accent-[#FF6600]"
                        />
                        <span className="truncate" title={fieldKey}>{fieldKey}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Toggle dry-run */}
              <div className="flex items-center gap-4 bg-[#1C2230] rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${dryRun ? 'bg-amber-500' : 'bg-[#2A3040]'}`} onClick={() => setDryRun(!dryRun)}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${dryRun ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-[#F0F2F5] flex items-center gap-2">
                      <Eye size={14} className={dryRun ? 'text-amber-400' : 'text-[#6B7280]'} />
                      Solo simular (dry-run)
                    </span>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">Calcula qué pasaría sin tocar la base.</p>
                  </div>
                </label>
                <button
                  onClick={handleFindDuplicates}
                  disabled={findingDups || Object.keys(mapping).length === 0}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1A1F2E] border border-[#2A3040] text-[#9CA3AF] hover:text-[#FF6600] hover:border-[#FF6600] disabled:opacity-50"
                >
                  {findingDups ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  Detectar duplicados
                </button>
              </div>

              {/* Mapping */}
              <div>
                <h3 className="text-sm font-semibold text-[#F0F2F5] mb-3 flex items-center gap-2">
                  Mapeo de columnas
                  <span className="text-[10px] text-[#6B7280] font-normal">(podés ajustar y agregar transformaciones por columna)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {csvHeaders.map((header, idx) => {
                    const mappedKey = mapping[idx]
                    const isMapped = !!mappedKey
                    const hasTransforms = (colTransforms[idx]?.length || 0) > 0
                    return (
                      <div key={idx} className={`flex items-center gap-2 rounded-lg p-3 ${isMapped ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-[#1C2230]'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#9CA3AF] truncate" title={header}>
                            <span className="text-[#F0F2F5] font-medium">{header}</span>
                          </p>
                        </div>
                        <ArrowRight size={14} className={isMapped ? 'text-emerald-400 shrink-0' : 'text-[#4B5563] shrink-0'} />
                        <select
                          value={mappedKey || ''}
                          onChange={(e) => updateMapping(idx, e.target.value)}
                          className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5] max-w-[150px] focus:outline-none focus:border-[#FF6600]"
                        >
                          <option value="">-- No importar --</option>
                          {allFields.map((f) => (
                            <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                          ))}
                          {mappedKey && !allFields.find(f => f.key === mappedKey) && (
                            <option value={mappedKey}>{mappedKey}</option>
                          )}
                        </select>
                        {isMapped && (
                          <button
                            onClick={() => setEditingTransformsCol(idx)}
                            title="Transformaciones"
                            className={`p-1.5 rounded ${hasTransforms ? 'bg-[#FF6600]/20 text-[#FF6600]' : 'text-[#6B7280] hover:text-[#FF6600] hover:bg-[#1A1F2E]'}`}
                          >
                            <Sparkles size={12} />
                            {hasTransforms && <span className="ml-1 text-[9px] font-bold">{colTransforms[idx]?.length}</span>}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <h3 className="text-sm font-semibold text-[#F0F2F5] mb-3">
                  Vista previa <span className="text-[#6B7280] font-normal">(primeras {previewRows.length} de {csvRows.length})</span>
                </h3>
                <div className="overflow-x-auto rounded-lg border border-[#1E2330]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#1C2230]">
                        <th className="px-3 py-2 text-left text-[#6B7280] font-medium">#</th>
                        {csvHeaders.map((h, idx) => {
                          const mappedFieldKey = mapping[idx]
                          const mappedField = fields.find(f => f.key === mappedFieldKey)
                          return (
                            <th key={idx} className="px-3 py-2 text-left min-w-[120px]">
                              <span className="text-[#6B7280]">{h}</span>
                              {mappedFieldKey && (
                                <span className="block text-[10px] mt-0.5 text-[#FF6600]">→ {mappedField?.label || mappedFieldKey}</span>
                              )}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-t border-[#1E2330] hover:bg-[#1C2230]/50">
                          <td className="px-3 py-2 text-[#4B5563]">{rowIdx + 1}</td>
                          {csvHeaders.map((_, colIdx) => {
                            const val = row[colIdx] || ''
                            return (
                              <td key={colIdx} className="px-3 py-2 text-[#F0F2F5] max-w-[200px] truncate" title={val}>
                                {val || <span className="text-[#2A3040]">—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-red-400" />
                    <h4 className="text-sm font-semibold text-red-400">Errores de validación</h4>
                  </div>
                  <ul className="space-y-1">
                    {validationErrors.map((err, i) => <li key={i} className="text-xs text-red-300">• {err}</li>)}
                  </ul>
                </div>
              )}

              {/* Progress */}
              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#9CA3AF] flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-[#FF6600]" />
                      {dryRun ? 'Simulando...' : `Importando (${importMode})...`}
                    </span>
                    <span className="text-[#FF6600] font-bold">{progress}%</span>
                  </div>
                  <div className="w-full bg-[#1E2330] rounded-full h-2.5 overflow-hidden">
                    <div className="h-full bg-[#FF6600] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Dry-run report */}
              {dryRunReport && (
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-5 space-y-3">
                  <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                    <Eye size={14} /> Reporte de simulación
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-[#141820] rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-emerald-400">{dryRunReport.insert}</p>
                      <p className="text-[10px] text-[#6B7280]">Insertaría</p>
                    </div>
                    <div className="bg-[#141820] rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-blue-400">{dryRunReport.update}</p>
                      <p className="text-[10px] text-[#6B7280]">Actualizaría</p>
                    </div>
                    <div className="bg-[#141820] rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-yellow-400">{dryRunReport.skip}</p>
                      <p className="text-[10px] text-[#6B7280]">Saltearía</p>
                    </div>
                    <div className="bg-[#141820] rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-red-400">{dryRunReport.fail}</p>
                      <p className="text-[10px] text-[#6B7280]">Fallarían</p>
                    </div>
                    {importMode === 'sync' && (
                      <div className={`bg-[#141820] rounded-lg p-3 text-center border ${dryRunReport.syncDescat > csvRows.length * 0.1 ? 'border-red-500/50' : 'border-transparent'}`}>
                        <p className={`text-lg font-bold ${dryRunReport.syncDescat > csvRows.length * 0.1 ? 'text-red-400' : 'text-orange-400'}`}>{dryRunReport.syncDescat}</p>
                        <p className="text-[10px] text-[#6B7280]">Descatalogaría</p>
                      </div>
                    )}
                  </div>

                  {importMode === 'sync' && dryRunReport.syncDescat > csvRows.length * 0.1 && (
                    <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-xs text-red-300">
                      <strong>Cuidado:</strong> más del 10% del universo se descatalogaría ({dryRunReport.syncDescat} de ~{csvRows.length} filas activas). Verificá el filtro o el archivo.
                    </div>
                  )}

                  {dryRunReport.sampleUpdates.length > 0 && (
                    <details className="bg-[#0F1218] rounded-lg p-3">
                      <summary className="cursor-pointer text-xs text-[#9CA3AF] font-semibold">Ver muestra de cambios ({dryRunReport.sampleUpdates.length})</summary>
                      <div className="mt-2 space-y-2 max-h-[260px] overflow-y-auto">
                        {dryRunReport.sampleUpdates.map((u, i) => (
                          <div key={i} className="bg-[#0A0D12] rounded p-2 text-[11px]">
                            <p className="font-mono text-[#FF6600] mb-1">{u.keyValue}</p>
                            {Object.entries(u.changes).map(([k, c]) => (
                              <div key={k} className="grid grid-cols-[100px_1fr_auto_1fr] gap-2 items-center text-[10px]">
                                <span className="text-[#6B7280]">{k}</span>
                                <span className="text-[#9CA3AF] truncate">{JSON.stringify(c.from)}</span>
                                <ArrowRight size={10} className="text-[#FF6600]" />
                                <span className="text-emerald-400 truncate">{JSON.stringify(c.to)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {dryRunReport.failures.length > 0 && (
                    <details className="bg-red-500/5 rounded-lg p-3">
                      <summary className="cursor-pointer text-xs text-red-400 font-semibold">Ver fallas ({dryRunReport.failures.length})</summary>
                      <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
                        {dryRunReport.failures.slice(0, 50).map((f, i) => (
                          <p key={i} className="text-[10px] text-red-300">Fila {f.row}: {f.error}</p>
                        ))}
                      </div>
                    </details>
                  )}

                  <button
                    onClick={() => {
                      setDryRun(false)
                      setDryRunReport(null)
                      setTimeout(() => { void handleImport() }, 50)
                    }}
                    disabled={importMode === 'sync' && dryRunReport.syncDescat > csvRows.length * 0.5}
                    className="w-full py-2 rounded-lg bg-[#FF6600] hover:bg-[#FF8833] text-white text-sm font-bold disabled:opacity-50"
                  >
                    Confirmar después de simular ({dryRunReport.insert + dryRunReport.update}{importMode === 'sync' ? ` + ${dryRunReport.syncDescat} descat.` : ''} cambios)
                  </button>
                </div>
              )}

              {/* Results */}
              {results && (
                <div className="bg-[#1C2230] border border-[#2A3040] rounded-lg p-5 space-y-3">
                  <h4 className="text-sm font-semibold text-[#F0F2F5]">Resultado</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#141820] rounded-lg p-3 text-center">
                      <CheckCircle size={18} className="text-green-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-400">{results.inserted}</p>
                      <p className="text-[10px] text-[#6B7280]">Insertados</p>
                    </div>
                    <div className="bg-[#141820] rounded-lg p-3 text-center">
                      <RefreshCw size={18} className="text-blue-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-blue-400">{results.updated}</p>
                      <p className="text-[10px] text-[#6B7280]">Actualizados</p>
                    </div>
                    <div className="bg-[#141820] rounded-lg p-3 text-center">
                      <AlertTriangle size={18} className="text-yellow-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-yellow-400">{results.skipped}</p>
                      <p className="text-[10px] text-[#6B7280]">Omitidos</p>
                    </div>
                    <div className="bg-[#141820] rounded-lg p-3 text-center">
                      <XCircle size={18} className="text-red-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-red-400">{results.errors.length}</p>
                      <p className="text-[10px] text-[#6B7280]">Errores</p>
                    </div>
                  </div>

                  {results.errors.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {results.errors.slice(0, 20).map((err, i) => <p key={i} className="text-xs text-red-300">• {err}</p>)}
                    </div>
                  )}

                  {lastJobId && (results.inserted > 0 || results.updated > 0) && (
                    <div className="pt-2 border-t border-[#2A3040] flex items-center justify-between">
                      <p className="text-[10px] text-[#6B7280]">Job: <span className="font-mono">{lastJobId.slice(0, 8)}</span></p>
                      <button
                        onClick={handleRevertLastJob}
                        disabled={reverting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-50"
                      >
                        {reverting ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
                        Revertir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#1E2330] bg-[#0F1318]">
              <p className="text-xs text-[#6B7280]">
                {Object.keys(mapping).length} columnas mapeadas de {csvHeaders.length}
                {Object.keys(colTransforms).length > 0 && (
                  <span className="text-[#FF6600] ml-2">· {Object.keys(colTransforms).length} con transforms</span>
                )}
                {duplicates.length > 0 && (
                  <span className="text-amber-400 ml-2">· {duplicates.length} dups detectados</span>
                )}
              </p>
              <div className="flex gap-3">
                {!importing && !results && (
                  <button onClick={handleClose} className="px-4 py-2 text-sm text-[#9CA3AF] hover:text-[#F0F2F5]">Cancelar</button>
                )}
                {results ? (
                  <button onClick={handleClose} className="px-5 py-2 text-sm font-medium bg-[#FF6600] text-white rounded-lg hover:bg-[#FF6600]/90">Cerrar</button>
                ) : (
                  <button
                    onClick={handleImport}
                    disabled={importing || Object.keys(mapping).length === 0}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-[#FF6600] text-white rounded-lg hover:bg-[#FF6600]/90 disabled:opacity-50"
                  >
                    {importing ? (
                      <><Loader2 size={14} className="animate-spin" />{dryRun ? 'Simulando...' : 'Importando...'}</>
                    ) : dryRun ? (
                      <><Eye size={14} />Simular {csvRows.length} filas</>
                    ) : (
                      <><Upload size={14} />Importar {csvRows.length} filas ({importMode})</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editor de transforms por columna */}
      {editingTransformsCol !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingTransformsCol(null)} />
          <div className="relative w-[min(92vw,640px)] bg-[#141820] border border-[#1E2330] rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E2330]">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#FF6600]" />
                <strong className="text-sm text-[#F0F2F5]">Transformar &laquo;{csvHeaders[editingTransformsCol]}&raquo;</strong>
              </div>
              <button onClick={() => setEditingTransformsCol(null)} className="text-[#6B7280] hover:text-[#F0F2F5]">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              {editingSteps.length === 0 && (
                <p className="text-xs text-[#6B7280] text-center py-4">No hay transformaciones. Agregá una abajo.</p>
              )}
              {editingSteps.map((step, sIdx) => (
                <div key={sIdx} className="bg-[#1C2230] rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={step.op}
                      onChange={e => updateTransformStep(editingTransformsCol, sIdx, { op: e.target.value as TransformOp })}
                      className="flex-1 bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]"
                    >
                      {(Object.keys(TRANSFORM_OP_LABELS) as TransformOp[]).map(op => (
                        <option key={op} value={op}>{TRANSFORM_OP_LABELS[op]}</option>
                      ))}
                    </select>
                    <button onClick={() => moveTransformStep(editingTransformsCol, sIdx, -1)} disabled={sIdx === 0} className="p-1.5 rounded text-[#6B7280] hover:text-[#FF6600] disabled:opacity-30">
                      <ChevronUp size={12} />
                    </button>
                    <button onClick={() => moveTransformStep(editingTransformsCol, sIdx, 1)} disabled={sIdx === editingSteps.length - 1} className="p-1.5 rounded text-[#6B7280] hover:text-[#FF6600] disabled:opacity-30">
                      <ChevronDown size={12} />
                    </button>
                    <button onClick={() => removeTransformStep(editingTransformsCol, sIdx)} className="p-1.5 rounded text-red-400 hover:bg-red-500/10">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {/* Inputs según op */}
                  {(step.op === 'multiply' || step.op === 'divide' || step.op === 'add' || step.op === 'subtract' || step.op === 'add_pct' || step.op === 'round') && (
                    <input
                      type="number"
                      placeholder="Valor"
                      value={typeof step.value === 'number' ? step.value : ''}
                      onChange={e => updateTransformStep(editingTransformsCol, sIdx, { value: e.target.value === '' ? undefined : Number(e.target.value) })}
                      className="w-full bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]"
                    />
                  )}
                  {(step.op === 'prefix' || step.op === 'suffix' || step.op === 'concat' || step.op === 'empty_to') && (
                    <input
                      type="text"
                      placeholder="Texto"
                      value={typeof step.value === 'string' ? step.value : ''}
                      onChange={e => updateTransformStep(editingTransformsCol, sIdx, { value: e.target.value })}
                      className="w-full bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]"
                    />
                  )}
                  {step.op === 'replace' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Buscar" value={step.find || ''} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { find: e.target.value })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]" />
                      <input type="text" placeholder="Reemplazo" value={step.replace || ''} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { replace: e.target.value })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]" />
                    </div>
                  )}
                  {step.op === 'regex_replace' && (
                    <div className="grid grid-cols-3 gap-2">
                      <input type="text" placeholder="Pattern" value={step.pattern || ''} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { pattern: e.target.value })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5] font-mono" />
                      <input type="text" placeholder="Replacement" value={step.replacement || ''} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { replacement: e.target.value })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5] font-mono" />
                      <input type="text" placeholder="Flags (gi)" value={step.flags || ''} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { flags: e.target.value })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5] font-mono" />
                    </div>
                  )}
                  {step.op === 'split' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Separador" value={step.separator || ''} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { separator: e.target.value })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]" />
                      <input type="number" placeholder="Índice (0..)" value={step.index ?? ''} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { index: e.target.value === '' ? undefined : Number(e.target.value) })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]" />
                    </div>
                  )}
                  {step.op === 'fx_convert' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="From (USD)" value={step.from || ''} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { from: e.target.value.toUpperCase() })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]" />
                      <input type="text" placeholder="To (EUR)" value={step.to || ''} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { to: e.target.value.toUpperCase() })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]" />
                    </div>
                  )}
                  {step.op === 'truthy_to' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Si truthy → " value={String(step.true_val ?? '')} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { true_val: e.target.value })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]" />
                      <input type="text" placeholder="Si falsy → " value={String(step.false_val ?? '')} onChange={e => updateTransformStep(editingTransformsCol, sIdx, { false_val: e.target.value })} className="bg-[#141820] border border-[#2A3040] rounded-lg px-2 py-1.5 text-xs text-[#F0F2F5]" />
                    </div>
                  )}
                </div>
              ))}

              <select
                value=""
                onChange={e => { if (e.target.value) { addTransformStep(editingTransformsCol, e.target.value as TransformOp); e.target.value = '' } }}
                className="w-full bg-[#1A1F2E] border border-dashed border-[#FF6600]/40 rounded-lg px-2 py-2 text-xs text-[#FF6600] hover:bg-[#FF6600]/5 cursor-pointer"
              >
                <option value="">+ Agregar transformación</option>
                {(Object.keys(TRANSFORM_OP_LABELS) as TransformOp[]).map(op => (
                  <option key={op} value={op}>{TRANSFORM_OP_LABELS[op]}</option>
                ))}
              </select>
            </div>
            <div className="border-t border-[#1E2330] p-4 bg-[#0F1318] space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-[#6B7280]">Preview (fila 1)</p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#9CA3AF] truncate flex-1 font-mono bg-[#0A0D12] rounded px-2 py-1.5">{previewBefore || <span className="text-[#4B5563]">vacío</span>}</span>
                <ArrowRight size={14} className="text-[#FF6600] shrink-0" />
                <span className="text-emerald-400 truncate flex-1 font-mono bg-[#0A0D12] rounded px-2 py-1.5">{String(previewAfter ?? '')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Guardar plantilla */}
      {showSaveTpl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSaveTpl(false)} />
          <div className="relative w-[min(92vw,500px)] bg-[#141820] border border-[#1E2330] rounded-2xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E2330]">
              <strong className="text-sm text-[#F0F2F5] flex items-center gap-2">
                <Save size={16} className="text-[#FF6600]" />
                Guardar plantilla
              </strong>
              <button onClick={() => setShowSaveTpl(false)} className="text-[#6B7280] hover:text-[#F0F2F5]"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">Nombre *</label>
                <input type="text" value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Ej: Proveedor X — lista mensual" className="w-full bg-[#1C2230] border border-[#2A3040] rounded-lg px-3 py-2 text-sm text-[#F0F2F5] focus:outline-none focus:border-[#FF6600]" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-[#6B7280] mb-1">Descripción</label>
                <textarea value={tplDesc} onChange={e => setTplDesc(e.target.value)} rows={2} className="w-full bg-[#1C2230] border border-[#2A3040] rounded-lg px-3 py-2 text-sm text-[#F0F2F5] focus:outline-none focus:border-[#FF6600]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-xs text-[#F0F2F5] cursor-pointer">
                  <input type="checkbox" checked={tplShared} onChange={e => setTplShared(e.target.checked)} className="accent-[#FF6600]" />
                  Compartir con la empresa
                </label>
                <label className="flex items-center gap-2 text-xs text-[#F0F2F5] cursor-pointer">
                  <input type="checkbox" checked={tplDefault} onChange={e => setTplDefault(e.target.checked)} className="accent-[#FF6600]" />
                  Default para esta tabla
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowSaveTpl(false)} className="px-3 py-1.5 rounded-lg text-xs text-[#9CA3AF] hover:text-[#F0F2F5]">Cancelar</button>
                <button onClick={handleSaveTemplate} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#FF6600] text-white hover:bg-[#FF8833]">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Duplicados detectados */}
      {showDups && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDups(false)} />
          <div className="relative w-[min(95vw,900px)] bg-[#141820] border border-[#1E2330] rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E2330]">
              <strong className="text-sm text-[#F0F2F5] flex items-center gap-2">
                <Search size={16} className="text-amber-400" />
                Duplicados candidatos ({duplicates.length})
              </strong>
              <button onClick={() => setShowDups(false)} className="text-[#6B7280] hover:text-[#F0F2F5]"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              {duplicates.length === 0 && (
                <p className="text-sm text-[#9CA3AF] text-center py-8">No se encontraron duplicados con threshold 0.75 ✓</p>
              )}
              {duplicates.map(d => {
                const decision = dupDecisions[d.rowIndex] ?? 'pending'
                const isMerge = typeof decision === 'object' && decision !== null && 'merge_with_sku' in decision
                return (
                  <div key={d.rowIndex} className="bg-[#1C2230] border border-[#2A3040] rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#9CA3AF]">
                        Fila <span className="text-[#FF6600] font-bold">{d.rowIndex + 2}</span>
                        {' · SKU: '}<span className="font-mono text-[#F0F2F5]">{d.incoming.sku || '—'}</span>
                        {d.incoming.name && <span> · {d.incoming.name.substring(0, 50)}</span>}
                      </p>
                      <div className="flex gap-1">
                        <button onClick={() => setDupDecisions(p => ({ ...p, [d.rowIndex]: 'ignore' }))} className={`px-2 py-1 rounded text-[10px] font-bold ${decision === 'ignore' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-[#0F1218] text-[#9CA3AF] hover:text-blue-400'}`}>Ignorar</button>
                        <button onClick={() => setDupDecisions(p => ({ ...p, [d.rowIndex]: 'skip' }))} className={`px-2 py-1 rounded text-[10px] font-bold ${decision === 'skip' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' : 'bg-[#0F1218] text-[#9CA3AF] hover:text-yellow-400'}`}>Saltar</button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {d.matches.map(m => (
                        <div key={m.product_id} className="flex items-center gap-2 bg-[#0F1218] rounded p-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#F0F2F5] truncate"><span className="font-mono text-[#FF6600]">{m.product_sku}</span> · {m.product_name}</p>
                            <p className="text-[10px] text-[#6B7280]">{m.reason} · sim={Math.round(m.similarity * 100)}%</p>
                          </div>
                          <div className="w-20 h-1.5 bg-[#1C2230] rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400" style={{ width: `${m.similarity * 100}%` }} />
                          </div>
                          <button
                            onClick={() => setDupDecisions(p => ({ ...p, [d.rowIndex]: { merge_with_sku: m.product_sku } }))}
                            className={`px-2 py-1 rounded text-[10px] font-bold ${isMerge && (decision as { merge_with_sku: string }).merge_with_sku === m.product_sku ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-[#1C2230] text-[#9CA3AF] hover:text-emerald-400'}`}
                          >
                            Mergear
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-[#1E2330] p-4 bg-[#0F1318] flex justify-end gap-2">
              <button onClick={() => setShowDups(false)} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#FF6600] text-white hover:bg-[#FF8833]">Aplicar decisiones</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Re-export para si alguien quiere usar deleteTemplate desde acá
export { deleteTemplate }
