/**
 * Feed Google Shopping — XML RSS 2.0 con namespace `g:`.
 * https://support.google.com/merchants/answer/7052112
 */

import { type FeedProduct, type FeedOptions, escapeXml, productLink } from './types'

export function generateGoogleShopping(products: FeedProduct[], opts: FeedOptions = {}): string {
  const currency = opts.currency || 'EUR'
  const condition = opts.defaultCondition || 'new'
  const availability = opts.defaultAvailability || 'in stock'

  const items = products.map(p => {
    const link = productLink(p, opts.baseUrl)
    const imageLink = p.image_url || ''
    const additional = (p.gallery_urls || []).slice(0, 10).map(g => g.url).filter(Boolean)
    const price = p.price_eur != null ? `${p.price_eur.toFixed(2)} ${currency}` : ''

    const parts: string[] = []
    parts.push(`    <item>`)
    parts.push(`      <g:id>${escapeXml(p.sku)}</g:id>`)
    parts.push(`      <title>${escapeXml(p.name)}</title>`)
    if (p.description) parts.push(`      <description>${escapeXml(p.description)}</description>`)
    parts.push(`      <link>${escapeXml(link)}</link>`)
    if (imageLink) parts.push(`      <g:image_link>${escapeXml(imageLink)}</g:image_link>`)
    for (const u of additional) parts.push(`      <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`)
    if (price) parts.push(`      <g:price>${escapeXml(price)}</g:price>`)
    if (p.brand) parts.push(`      <g:brand>${escapeXml(p.brand)}</g:brand>`)
    if (p.ean) parts.push(`      <g:gtin>${escapeXml(p.ean)}</g:gtin>`)
    if (p.manufacturer_code) parts.push(`      <g:mpn>${escapeXml(p.manufacturer_code)}</g:mpn>`)
    parts.push(`      <g:condition>${condition}</g:condition>`)
    parts.push(`      <g:availability>${availability}</g:availability>`)
    if (p.category) parts.push(`      <g:google_product_category>${escapeXml(p.category)}</g:google_product_category>`)
    if (p.parent_product_id) parts.push(`      <g:item_group_id>${escapeXml(p.parent_product_id)}</g:item_group_id>`)
    parts.push(`    </item>`)
    return parts.join('\n')
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Catálogo</title>
    <link>${escapeXml(opts.baseUrl || 'https://example.com')}</link>
    <description>Feed Google Shopping</description>
${items}
  </channel>
</rss>`
}
