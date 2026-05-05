/**
 * Motor de reglas para `tt_catalog_rules`.
 *
 * Estructura de una regla:
 *   {
 *     trigger_event: 'product_updated' | 'product_created' | 'lifecycle_changed' |
 *                    'lot_expiring' | 'serial_calibration_due' |
 *                    'scheduled_daily' | 'scheduled_weekly'
 *     conditions: Array<{ field, op, value }>
 *     actions: Array<{ type, params }>
 *   }
 *
 * Operadores soportados:
 *   eq, ne, gt, gte, lt, lte, in, nin, contains, starts_with, changed
 *
 * Tipos de acción:
 *   notify_user, notify_email, create_oc_draft, update_field,
 *   log_to_audit, webhook
 */

import { createClient } from '@/lib/supabase/client'

export type RuleEvent =
  | 'product_updated'
  | 'product_created'
  | 'lifecycle_changed'
  | 'lot_expiring'
  | 'serial_calibration_due'
  | 'scheduled_daily'
  | 'scheduled_weekly'

export interface RuleCondition {
  field: string
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'starts_with' | 'changed'
  value: unknown
}

export interface RuleAction {
  type: 'notify_user' | 'notify_email' | 'create_oc_draft' | 'update_field' | 'log_to_audit' | 'webhook'
  params: Record<string, unknown>
}

export interface CatalogRule {
  id: string
  company_id: string | null
  name: string
  trigger_event: RuleEvent
  conditions: RuleCondition[]
  actions: RuleAction[]
  is_active: boolean
  priority: number
  last_fired_at: string | null
  fire_count: number
}

export interface RuleContext {
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  data?: Record<string, unknown> | null
  // Cualquier otro key que quiera leer la condición
  [k: string]: unknown
}

// -- Listing & CRUD --------------------------------------------------------

export async function listRules(): Promise<CatalogRule[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('tt_catalog_rules')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('listRules falló:', error.message)
    return []
  }
  return (data || []) as CatalogRule[]
}

export async function saveRule(r: Partial<CatalogRule> & { name: string; trigger_event: RuleEvent }): Promise<string | null> {
  const sb = createClient()
  const payload = {
    company_id: r.company_id ?? null,
    name: r.name,
    trigger_event: r.trigger_event,
    conditions: r.conditions ?? [],
    actions: r.actions ?? [],
    is_active: r.is_active ?? true,
    priority: r.priority ?? 100,
  }
  if (r.id) {
    const { error } = await sb.from('tt_catalog_rules').update(payload).eq('id', r.id)
    if (error) { console.warn('saveRule update falló:', error.message); return null }
    return r.id
  }
  const { data, error } = await sb.from('tt_catalog_rules').insert(payload).select('id').single()
  if (error || !data) { console.warn('saveRule insert falló:', error?.message); return null }
  return (data as { id: string }).id
}

export async function deleteRule(id: string): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('tt_catalog_rules').delete().eq('id', id)
  if (error) console.warn('deleteRule falló:', error.message)
}

// -- Evaluation ------------------------------------------------------------

function getField(ctx: RuleContext, path: string): unknown {
  // path puede ser "after.price_eur" o "before.brand"
  const parts = path.split('.')
  let cur: unknown = ctx
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}

export function evaluateRule(rule: CatalogRule, ctx: RuleContext): { matched: boolean; reason: string } {
  if (!rule.conditions || rule.conditions.length === 0) {
    return { matched: true, reason: 'sin condiciones' }
  }
  for (const cond of rule.conditions) {
    const v = getField(ctx, cond.field)
    const cv = cond.value
    let pass = false
    switch (cond.op) {
      case 'eq': pass = v === cv; break
      case 'ne': pass = v !== cv; break
      case 'gt': pass = typeof v === 'number' && typeof cv === 'number' && v > cv; break
      case 'gte': pass = typeof v === 'number' && typeof cv === 'number' && v >= cv; break
      case 'lt': pass = typeof v === 'number' && typeof cv === 'number' && v < cv; break
      case 'lte': pass = typeof v === 'number' && typeof cv === 'number' && v <= cv; break
      case 'in': pass = Array.isArray(cv) && cv.includes(v); break
      case 'nin': pass = Array.isArray(cv) && !cv.includes(v); break
      case 'contains': pass = typeof v === 'string' && typeof cv === 'string' && v.includes(cv); break
      case 'starts_with': pass = typeof v === 'string' && typeof cv === 'string' && v.startsWith(cv); break
      case 'changed': {
        // field ej: "price_eur" → compara before.price_eur vs after.price_eur
        const before = getField(ctx, `before.${cond.field}`)
        const after = getField(ctx, `after.${cond.field}`)
        pass = before !== after
        break
      }
    }
    if (!pass) return { matched: false, reason: `${cond.field} ${cond.op} no cumple` }
  }
  return { matched: true, reason: 'todas las condiciones cumplen' }
}

// -- Execution -------------------------------------------------------------

export async function executeActions(rule: CatalogRule, ctx: RuleContext): Promise<void> {
  const sb = createClient()
  for (const action of rule.actions) {
    try {
      switch (action.type) {
        case 'log_to_audit': {
          // Best-effort: si hay tabla tt_audit_log la usamos
          const event = action.params.event || `rule_${rule.name}`
          await sb.from('tt_audit_log').insert({
            event_type: event,
            payload: { rule_id: rule.id, ctx },
          })
          break
        }
        case 'update_field': {
          const table = action.params.table as string
          const id = (action.params.id as string) || (ctx.after as Record<string, unknown> | null)?.id as string
          const patch = action.params.patch as Record<string, unknown>
          if (table && id && patch) {
            await sb.from(table).update(patch).eq('id', id)
          }
          break
        }
        case 'webhook': {
          const url = action.params.url as string
          if (url) {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rule: rule.name, ctx }),
            }).catch(e => console.warn('webhook action falló:', (e as Error).message))
          }
          break
        }
        case 'notify_email': {
          // Server-only — desde el browser no podemos llamar Resend directo.
          // Disparamos un endpoint helper si existe; si no, log.
          await fetch('/api/notifications/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: action.params.to,
              subject: action.params.subject || `Regla: ${rule.name}`,
              body: action.params.body || JSON.stringify(ctx, null, 2),
            }),
          }).catch(() => {/* endpoint puede no existir todavía */})
          break
        }
        case 'notify_user': {
          // Inserta en tt_notifications si la tabla existe
          await sb.from('tt_notifications').insert({
            user_id: action.params.user_id,
            title: action.params.title || `Regla: ${rule.name}`,
            body: action.params.body || '',
            severity: action.params.severity || 'info',
          })
          break
        }
        case 'create_oc_draft': {
          // Crea borrador de orden de compra
          const supplierId = action.params.supplier_id
          const productId = (ctx.after as Record<string, unknown> | null)?.id as string
          await sb.from('tt_purchase_orders').insert({
            supplier_id: supplierId,
            status: 'borrador',
            notes: `Auto-creada por regla ${rule.name} para producto ${productId}`,
          })
          break
        }
      }
    } catch (e) {
      console.warn(`action ${action.type} falló en regla ${rule.name}:`, (e as Error).message)
    }
  }
}

/** Busca reglas con ese trigger_event, evalúa y ejecuta las que matchean. */
export async function triggerRules(
  event: RuleEvent,
  ctx: RuleContext
): Promise<{ fired: number; results: Array<{ rule: string; matched: boolean; reason: string }> }> {
  const sb = createClient()
  const { data, error } = await sb
    .from('tt_catalog_rules')
    .select('*')
    .eq('trigger_event', event)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (error) {
    console.warn('triggerRules query falló:', error.message)
    return { fired: 0, results: [] }
  }
  const rules = (data || []) as CatalogRule[]
  const results: Array<{ rule: string; matched: boolean; reason: string }> = []
  let fired = 0

  for (const rule of rules) {
    const { matched, reason } = evaluateRule(rule, ctx)
    results.push({ rule: rule.name, matched, reason })
    if (matched) {
      await executeActions(rule, ctx)
      fired++
      // Bump fire_count + last_fired_at (no bloqueante)
      void sb.from('tt_catalog_rules').update({
        fire_count: (rule.fire_count || 0) + 1,
        last_fired_at: new Date().toISOString(),
      }).eq('id', rule.id)
    }
  }

  return { fired, results }
}
