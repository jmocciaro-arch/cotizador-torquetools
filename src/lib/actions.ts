'use server'

import { createClient } from '@/lib/supabase/server'

// ─── Generate next document number ───
export async function generateDocNumber(
  type: 'COT' | 'PED' | 'REM' | 'FAC' | 'OC' | 'SAT',
  companyId: string
): Promise<string> {
  const supabase = await createClient()

  const tableMap: Record<string, string> = {
    COT: 'tt_quotes',
    PED: 'tt_sales_orders',
    REM: 'tt_delivery_notes',
    FAC: 'tt_invoices',
    OC: 'tt_purchase_orders',
    SAT: 'tt_sat_tickets',
  }

  const table = tableMap[type]
  const year = new Date().getFullYear().toString().slice(-2)
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0')

  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const seq = ((count || 0) + 1).toString().padStart(4, '0')
  return `${type}-${year}${month}-${seq}`
}

// ─── Create quote and items in one transaction ───
export async function createQuote(data: {
  company_id: string
  client_id: string
  doc_number: string
  currency: string
  incoterm?: string
  validity_days?: number
  notes?: string
  items: Array<{
    product_id: string
    description: string
    quantity: number
    unit_price: number
    discount_pct?: number
  }>
}) {
  const supabase = await createClient()

  const subtotal = data.items.reduce((sum, item) => {
    const disc = item.discount_pct || 0
    return sum + item.quantity * item.unit_price * (1 - disc / 100)
  }, 0)

  const { data: quote, error: quoteError } = await supabase
    .from('tt_quotes')
    .insert({
      company_id: data.company_id,
      client_id: data.client_id,
      doc_number: data.doc_number,
      currency: data.currency,
      incoterm: data.incoterm || 'EXW',
      validity_days: data.validity_days || 30,
      notes: data.notes || '',
      status: 'draft',
      subtotal,
      tax_amount: 0,
      total: subtotal,
    })
    .select()
    .single()

  if (quoteError) throw new Error(quoteError.message)

  const itemsToInsert = data.items.map((item, idx) => ({
    quote_id: quote.id,
    product_id: item.product_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct || 0,
    line_total: item.quantity * item.unit_price * (1 - (item.discount_pct || 0) / 100),
    sort_order: idx,
  }))

  const { error: itemsError } = await supabase
    .from('tt_quote_items')
    .insert(itemsToInsert)

  if (itemsError) throw new Error(itemsError.message)

  await logActivity('quote', quote.id, 'created', `Cotización ${data.doc_number} creada`)

  return quote
}

// ─── Convert quote to sales order ───
export async function quoteToSalesOrder(quoteId: string) {
  const supabase = await createClient()

  const { data: quote, error: qErr } = await supabase
    .from('tt_quotes')
    .select('*, tt_quote_items(*)')
    .eq('id', quoteId)
    .single()

  if (qErr || !quote) throw new Error(qErr?.message || 'Cotización no encontrada')

  const docNumber = await generateDocNumber('PED', quote.company_id)

  const { data: so, error: soErr } = await supabase
    .from('tt_sales_orders')
    .insert({
      company_id: quote.company_id,
      client_id: quote.client_id,
      quote_id: quoteId,
      doc_number: docNumber,
      currency: quote.currency,
      status: 'open',
      subtotal: quote.subtotal,
      tax_amount: quote.tax_amount,
      total: quote.total,
      notes: quote.notes,
    })
    .select()
    .single()

  if (soErr) throw new Error(soErr.message)

  const soItems = (quote.tt_quote_items || []).map((item: Record<string, unknown>, idx: number) => ({
    sales_order_id: so.id,
    product_id: item.product_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct || 0,
    line_total: item.line_total,
    qty_ordered: item.quantity,
    qty_reserved: 0,
    qty_delivered: 0,
    qty_invoiced: 0,
    sort_order: idx,
  }))

  await supabase.from('tt_so_items').insert(soItems)

  await supabase
    .from('tt_quotes')
    .update({ status: 'accepted' })
    .eq('id', quoteId)

  await logActivity('sales_order', so.id, 'created', `Pedido ${docNumber} creado desde cotización ${quote.doc_number}`)

  return so
}

// ─── Create delivery note from SO ───
export async function createDeliveryNote(
  soId: string,
  items: Array<{ so_item_id: string; qty_to_deliver: number }>
) {
  const supabase = await createClient()

  const { data: so, error: soErr } = await supabase
    .from('tt_sales_orders')
    .select('*')
    .eq('id', soId)
    .single()

  if (soErr || !so) throw new Error('Pedido no encontrado')

  const docNumber = await generateDocNumber('REM', so.company_id)

  const { data: dn, error: dnErr } = await supabase
    .from('tt_delivery_notes')
    .insert({
      company_id: so.company_id,
      client_id: so.client_id,
      sales_order_id: soId,
      doc_number: docNumber,
      status: 'pending',
    })
    .select()
    .single()

  if (dnErr) throw new Error(dnErr.message)

  for (const item of items) {
    await supabase.from('tt_dn_items').insert({
      delivery_note_id: dn.id,
      so_item_id: item.so_item_id,
      quantity: item.qty_to_deliver,
    })

    // Update qty_delivered on SO item
    const { data: soItem } = await supabase
      .from('tt_so_items')
      .select('qty_delivered')
      .eq('id', item.so_item_id)
      .single()

    if (soItem) {
      await supabase
        .from('tt_so_items')
        .update({ qty_delivered: (soItem.qty_delivered || 0) + item.qty_to_deliver })
        .eq('id', item.so_item_id)
    }
  }

  await logActivity('delivery_note', dn.id, 'created', `Remito ${docNumber} creado desde pedido ${so.doc_number}`)

  return dn
}

// ─── Create invoice from delivery notes ───
export async function createInvoice(deliveryNoteIds: string[]) {
  const supabase = await createClient()

  if (!deliveryNoteIds.length) throw new Error('Seleccioná al menos un remito')

  const { data: firstDn } = await supabase
    .from('tt_delivery_notes')
    .select('*, tt_sales_orders!inner(*)')
    .eq('id', deliveryNoteIds[0])
    .single()

  if (!firstDn) throw new Error('Remito no encontrado')

  const so = (firstDn as Record<string, unknown>).tt_sales_orders as Record<string, unknown>
  const docNumber = await generateDocNumber('FAC', firstDn.company_id)

  const { data: invoice, error: invErr } = await supabase
    .from('tt_invoices')
    .insert({
      company_id: firstDn.company_id,
      client_id: firstDn.client_id,
      sales_order_id: firstDn.sales_order_id,
      doc_number: docNumber,
      status: 'draft',
      currency: so?.currency || 'EUR',
      subtotal: so?.subtotal || 0,
      tax_amount: so?.tax_amount || 0,
      total: so?.total || 0,
    })
    .select()
    .single()

  if (invErr) throw new Error(invErr.message)

  // Link delivery notes to invoice
  for (const dnId of deliveryNoteIds) {
    await supabase
      .from('tt_delivery_notes')
      .update({ invoice_id: invoice.id, status: 'invoiced' })
      .eq('id', dnId)
  }

  await logActivity('invoice', invoice.id, 'created', `Factura ${docNumber} creada`)

  return invoice
}

// ─── Log activity ───
export async function logActivity(
  entityType: string,
  entityId: string,
  action: string,
  detail: string,
  userId?: string
) {
  const supabase = await createClient()

  await supabase.from('tt_activity_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    detail,
    user_id: userId || null,
  })
}
