/**
 * Cron para catalog-rules con trigger scheduled_daily / scheduled_weekly.
 * Además dispara reglas para lotes próximos a vencer y series con calibración.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 300

interface RuleRow {
  id: string
  name: string
  trigger_event: string
  conditions: unknown[]
  actions: unknown[]
  is_active: boolean
  priority: number
  fire_count: number | null
}

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  return runHandler(req)
}

export async function POST(req: NextRequest) {
  return runHandler(req)
}

async function runHandler(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const day = new Date().getDay()  // 0 = domingo, 1 = lunes, ...
  const triggers = ['scheduled_daily']
  if (day === 1) triggers.push('scheduled_weekly')

  const { data: rules, error } = await sb
    .from('tt_catalog_rules')
    .select('*')
    .in('trigger_event', triggers)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const matched: Array<{ rule: string }> = []

  // Para cada regla: ejecutamos sus acciones con un context vacío (no hay before/after).
  // Las acciones del lado server (notify_email, webhook) deberían correr aquí.
  // Reusamos la lógica del engine pero ejecutada server-side.
  for (const rule of (rules || []) as RuleRow[]) {
    matched.push({ rule: rule.name })
    void sb.from('tt_catalog_rules').update({
      fire_count: (rule.fire_count || 0) + 1,
      last_fired_at: new Date().toISOString(),
    }).eq('id', rule.id)
    // TODO: ejecutar acciones server-side. Por ahora solo logueamos disparo —
    // el browser ejecuta la mayoría de las acciones cuando el usuario está
    // logueado. Para acciones puramente server-side hace falta portear
    // executeActions a un módulo server-only.
  }

  // Lotes a vencer + reglas lot_expiring
  const { data: expiring } = await sb.rpc('list_lots_expiring_soon', { p_days_ahead: 30 })
  if (Array.isArray(expiring) && expiring.length > 0) {
    matched.push({ rule: `lot_expiring_count_${expiring.length}` })
  }

  // Calibraciones próximas
  const { data: cals } = await sb.rpc('list_serials_calibration_due', { p_days_ahead: 30 })
  if (Array.isArray(cals) && cals.length > 0) {
    matched.push({ rule: `calibration_due_count_${cals.length}` })
  }

  return NextResponse.json({ ran: matched.length, matched })
}
