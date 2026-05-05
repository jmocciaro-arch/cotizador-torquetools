/**
 * GET /api/catalog/feed/[token]
 *
 * Endpoint público que sirve un feed de productos según `tt_catalog_feeds.public_token`.
 * No requiere auth (uso pensado para Google Merchant Center, Meta, etc.).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateFeed, type FeedType, type FeedProduct } from '@/lib/feeds'

export const runtime = 'nodejs'
export const maxDuration = 60

interface FeedRow {
  id: string
  company_id: string | null
  feed_type: FeedType
  filter: Record<string, unknown> | null
  field_mapping: Record<string, string> | null
  options: Record<string, unknown> | null
  is_public: boolean
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: feedData, error: feedErr } = await sb
    .from('tt_catalog_feeds')
    .select('id, company_id, feed_type, filter, field_mapping, options, is_public')
    .eq('public_token', token)
    .single()

  if (feedErr || !feedData) {
    return NextResponse.json({ error: 'Feed no encontrado' }, { status: 404 })
  }
  const feed = feedData as FeedRow
  if (!feed.is_public) {
    return NextResponse.json({ error: 'Feed no público' }, { status: 403 })
  }

  // Construir query de productos
  let q = sb.from('tt_products')
    .select('id, sku, name, description, brand, category, subcategory, price_eur, cost_eur, image_url, gallery_urls, ean, manufacturer_code, weight_kg, active, lifecycle_status')
    .eq('active', true)
    .limit(5000)

  const filter = feed.filter || {}
  if (filter.category) q = q.eq('category', filter.category as string)
  if (filter.brand) q = q.eq('brand', filter.brand as string)
  if (filter.lifecycle_status) q = q.eq('lifecycle_status', filter.lifecycle_status as string)
  if (feed.company_id) {
    // Si el feed está atado a una empresa, podríamos filtrar por precios de esa empresa
    // (no implementado todavía — TODO).
    void feed.company_id
  }

  const { data: products, error: prodErr } = await q
  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 500 })
  }

  const feedProducts = (products || []) as FeedProduct[]

  const baseUrl = (feed.options?.baseUrl as string | undefined) || req.nextUrl.origin
  const { content, contentType } = generateFeed(feed.feed_type, feedProducts, {
    baseUrl,
    currency: (feed.options?.currency as string | undefined) || 'EUR',
    fieldMapping: feed.field_mapping || undefined,
  })

  // Actualizar last_generated_at + last_item_count (no bloqueante)
  void sb.from('tt_catalog_feeds')
    .update({
      last_generated_at: new Date().toISOString(),
      last_item_count: feedProducts.length,
    })
    .eq('id', feed.id)
    .then(({ error }) => {
      if (error) console.warn('feed update last_generated_at falló:', error.message)
    })

  return new NextResponse(content, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=900',  // 15 min
    },
  })
}
