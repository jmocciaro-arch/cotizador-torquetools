'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Save, Trash2, Copy, X, Check, Globe, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'

interface FeedRecord {
  id: string
  company_id: string | null
  name: string
  feed_type: string
  filter: Record<string, unknown> | null
  field_mapping: Record<string, string> | null
  options: Record<string, unknown> | null
  public_token: string
  is_public: boolean
  last_generated_at: string | null
  last_item_count: number | null
}

const FEED_TYPES: Array<{ value: string; label: string }> = [
  { value: 'google_shopping', label: 'Google Shopping (XML)' },
  { value: 'meta_catalog', label: 'Meta Catalog (CSV)' },
  { value: 'mercadolibre', label: 'Mercado Libre (JSON)' },
  { value: 'amazon', label: 'Amazon (TSV)' },
  { value: 'custom_xml', label: 'Custom XML' },
  { value: 'custom_csv', label: 'Custom CSV' },
]

export function FeedsManager() {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [feeds, setFeeds] = useState<FeedRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Partial<FeedRecord> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/catalog/feeds')
      const j = await res.json()
      setFeeds(j.feeds || [])
    } catch (e) {
      console.warn('feeds reload falló', e)
      setFeeds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (open) reload() }, [open, reload])

  const handleSave = useCallback(async () => {
    if (!editing?.name?.trim() || !editing.feed_type) {
      addToast({ type: 'warning', title: 'Nombre y tipo son obligatorios' })
      return
    }
    if (editing.id) {
      const res = await fetch(`/api/catalog/feeds?id=${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (!res.ok) {
        addToast({ type: 'error', title: 'Error guardando' })
        return
      }
    } else {
      const res = await fetch('/api/catalog/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (!res.ok) {
        addToast({ type: 'error', title: 'Error creando' })
        return
      }
    }
    addToast({ type: 'success', title: 'Feed guardado' })
    setEditing(null)
    reload()
  }, [editing, addToast, reload])

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/catalog/feeds?id=${id}`, { method: 'DELETE' })
    setConfirmDelete(null)
    addToast({ type: 'success', title: 'Feed eliminado' })
    reload()
  }, [addToast, reload])

  const copyUrl = useCallback((feed: FeedRecord) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/api/catalog/feed/${feed.public_token}`
    navigator.clipboard.writeText(url)
    setCopiedId(feed.id)
    setTimeout(() => setCopiedId(null), 2000)
    addToast({ type: 'success', title: 'URL copiada' })
  }, [addToast])

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Globe size={14} /> Feeds eCommerce
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Feeds eCommerce" size="full">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#9CA3AF]">
              Generá feeds públicos para Google Shopping, Meta, Mercado Libre, Amazon.
            </p>
            <Button size="sm" variant="primary" onClick={() => setEditing({ name: '', feed_type: 'google_shopping', is_public: true, filter: {}, field_mapping: {}, options: {} })}>
              <Plus size={14} /> Nuevo feed
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-[#9CA3AF] py-8 text-center">Cargando...</div>
          ) : feeds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1E2330] p-8 text-center text-sm text-[#6B7280]">
              No hay feeds configurados.
            </div>
          ) : (
            <div className="rounded-xl border border-[#1E2330] bg-[#0F1218] overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0A0D12] text-[#6B7280] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Última gen.</th>
                    <th className="px-3 py-2 text-right">Items</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 w-48"></th>
                  </tr>
                </thead>
                <tbody>
                  {feeds.map(f => {
                    const url = typeof window !== 'undefined' ? `${window.location.origin}/api/catalog/feed/${f.public_token}` : ''
                    return (
                      <tr key={f.id} className="border-t border-[#1E2330] hover:bg-[#1A1F2E]">
                        <td className="px-3 py-2 font-medium text-[#F0F2F5]">{f.name}</td>
                        <td className="px-3 py-2 text-[#9CA3AF]">{FEED_TYPES.find(t => t.value === f.feed_type)?.label || f.feed_type}</td>
                        <td className="px-3 py-2 text-[#9CA3AF]">{f.last_generated_at ? new Date(f.last_generated_at).toLocaleString('es-AR') : '—'}</td>
                        <td className="px-3 py-2 text-right text-[#9CA3AF]">{f.last_item_count ?? '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant={f.is_public ? 'success' : 'default'} size="sm">{f.is_public ? 'Público' : 'Privado'}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right space-x-1">
                          <button onClick={() => copyUrl(f)} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#1E2330] text-[#9CA3AF] hover:bg-[#2A3040]">
                            {copiedId === f.id ? <Check size={11} /> : <Copy size={11} />}
                            {copiedId === f.id ? 'Copiado' : 'URL'}
                          </button>
                          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#1E2330] text-[#9CA3AF] hover:bg-[#2A3040]">
                            <ExternalLink size={11} /> Ver
                          </a>
                          <button onClick={() => setEditing(f)} className="text-[#FF6600] hover:underline text-xs ml-1">Editar</button>
                          {confirmDelete === f.id ? (
                            <button onClick={() => handleDelete(f.id)} className="ml-2 text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">Confirmá</button>
                          ) : (
                            <button onClick={() => setConfirmDelete(f.id)} className="ml-2 p-1 rounded hover:bg-red-500/10 text-[#6B7280] hover:text-red-400"><Trash2 size={12} /></button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal editor */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar feed' : 'Nuevo feed'} size="lg">
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Nombre *</label>
              <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Tipo *</label>
              <select value={editing.feed_type || ''} onChange={(e) => setEditing({ ...editing, feed_type: e.target.value })} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                {FEED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Filtro: categoría</label>
                <Input value={(editing.filter?.category as string) || ''} onChange={(e) => setEditing({ ...editing, filter: { ...editing.filter, category: e.target.value || undefined } })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Filtro: marca</label>
                <Input value={(editing.filter?.brand as string) || ''} onChange={(e) => setEditing({ ...editing, filter: { ...editing.filter, brand: e.target.value || undefined } })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Filtro: lifecycle</label>
                <select value={(editing.filter?.lifecycle_status as string) || ''} onChange={(e) => setEditing({ ...editing, filter: { ...editing.filter, lifecycle_status: e.target.value || undefined } })} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                  <option value="">Todos</option>
                  <option value="activo">Activo</option>
                  <option value="borrador">Borrador</option>
                  <option value="descatalogado">Descatalogado</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Currency</label>
                <Input value={(editing.options?.currency as string) || ''} onChange={(e) => setEditing({ ...editing, options: { ...editing.options, currency: e.target.value || undefined } })} placeholder="EUR" />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Base URL</label>
                <Input value={(editing.options?.baseUrl as string) || ''} onChange={(e) => setEditing({ ...editing, options: { ...editing.options, baseUrl: e.target.value || undefined } })} placeholder="https://torquetools.com" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <input type="checkbox" checked={editing.is_public ?? true} onChange={(e) => setEditing({ ...editing, is_public: e.target.checked })} />
              Hacer público (accesible vía URL con token)
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2330]">
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X size={14} /> Cancelar</Button>
              <Button size="sm" variant="primary" onClick={handleSave}><Save size={14} /> Guardar</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
