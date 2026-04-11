'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { SearchBar } from '@/components/ui/search-bar'
import { KPICard } from '@/components/ui/kpi-card'
import { Tabs } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { ExportButton } from '@/components/ui/export-button'
import { formatCurrency, formatDate, formatRelative, getInitials } from '@/lib/utils'
import { DocumentDetailLayout, type WorkflowStep } from '@/components/workflow/document-detail-layout'
import { DocumentItemsTree, type DocumentItem } from '@/components/workflow/document-items-tree'
import { DocumentListCard } from '@/components/workflow/document-list-card'
import type { Supplier, SupplierContact } from '@/types'
import {
  ShoppingCart, Plus, Package, Truck, CheckCircle, Clock,
  FileText, Loader2, X, Send, Users, DollarSign, FileCheck,
  Building2, Phone, Mail, MessageSquare, MapPin, Globe,
  Hash, ArrowLeft, Edit3, Save, Trash2, Star, ChevronRight,
  Contact
} from 'lucide-react'

type Row = Record<string, unknown>

const PO_STATUS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange' }> = {
  draft: { label: 'Borrador', variant: 'default' },
  sent: { label: 'Enviada', variant: 'info' },
  partial: { label: 'Parcial', variant: 'warning' },
  received: { label: 'Recibida', variant: 'success' },
  closed: { label: 'Cerrada', variant: 'danger' },
}

const comprasTabs = [
  { id: 'proveedores', label: 'Proveedores', icon: <Users size={16} /> },
  { id: 'pedidos', label: 'Pedidos', icon: <ShoppingCart size={16} /> },
  { id: 'recepciones', label: 'Recepciones', icon: <Truck size={16} /> },
  { id: 'facturas', label: 'Facturas compra', icon: <FileCheck size={16} /> },
]

// Helper: build workflow steps for a purchase order
function buildPOWorkflow(po: Row): WorkflowStep[] {
  const st = (po.status as string) || 'draft'
  return [
    { key: 'solicitud', label: 'Solicitud', icon: '\uD83D\uDCCB', status: 'completed', tooltip: 'Necesidad detectada' },
    {
      key: 'pap', label: 'Pedido proveedor', icon: '\uD83D\uDED2',
      status: st === 'draft' ? 'current' : st === 'sent' ? 'current' : 'completed',
      documentRef: (po.supplier_name as string) || '',
      date: po.created_at ? new Date(po.created_at as string).toLocaleDateString('es-ES') : '',
    },
    { key: 'recepcion', label: 'Recepcion', icon: '\uD83D\uDCE6', status: st === 'partial' ? 'partial' : st === 'received' || st === 'closed' ? 'completed' : 'pending' },
    { key: 'factura_compra', label: 'Factura compra', icon: '\uD83D\uDCB3', status: st === 'closed' ? 'completed' : 'pending' },
  ]
}

const countryFlags: Record<string, string> = { ES: '\u{1F1EA}\u{1F1F8}', AR: '\u{1F1E6}\u{1F1F7}', US: '\u{1F1FA}\u{1F1F8}', CL: '\u{1F1E8}\u{1F1F1}', UY: '\u{1F1FA}\u{1F1FE}', BR: '\u{1F1E7}\u{1F1F7}', MX: '\u{1F1F2}\u{1F1FD}', CO: '\u{1F1E8}\u{1F1F4}', DE: '\u{1F1E9}\u{1F1EA}', FR: '\u{1F1EB}\u{1F1F7}', IT: '\u{1F1EE}\u{1F1F9}', GB: '\u{1F1EC}\u{1F1E7}', CN: '\u{1F1E8}\u{1F1F3}', JP: '\u{1F1EF}\u{1F1F5}', TW: '\u{1F1F9}\u{1F1FC}', KR: '\u{1F1F0}\u{1F1F7}', PT: '\u{1F1F5}\u{1F1F9}' }
const countryNames: Record<string, string> = { ES: 'Espana', AR: 'Argentina', US: 'Estados Unidos', CL: 'Chile', UY: 'Uruguay', BR: 'Brasil', MX: 'Mexico', CO: 'Colombia', DE: 'Alemania', FR: 'Francia', IT: 'Italia', GB: 'Reino Unido', CN: 'China', JP: 'Japon', TW: 'Taiwan', KR: 'Corea del Sur', PT: 'Portugal' }

// ===============================================================
// SUPPLIER DETAIL VIEW (3-column layout like Clients)
// ===============================================================
function SupplierDetail({ supplier, onClose, onUpdate }: {
  supplier: Supplier
  onClose: () => void
  onUpdate: () => void
}) {
  const { addToast } = useToast()
  const supabase = createClient()
  const [activeDetailTab, setActiveDetailTab] = useState('datos')
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Supplier>>({})
  const [saving, setSaving] = useState(false)
  const [contacts, setContacts] = useState<SupplierContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [purchaseOrders, setPurchaseOrders] = useState<Row[]>([])
  const [loadingPOs, setLoadingPOs] = useState(true)
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', position: '', email: '', phone: '', whatsapp: '' })
  const [savingContact, setSavingContact] = useState(false)
  const [editingContact, setEditingContact] = useState<string | null>(null)
  const [editContactData, setEditContactData] = useState<Partial<SupplierContact>>({})

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true)
    const { data } = await supabase
      .from('tt_supplier_contacts')
      .select('*')
      .eq('supplier_id', supplier.id)
      .order('is_primary', { ascending: false })
    setContacts((data || []) as SupplierContact[])
    setLoadingContacts(false)
  }, [supplier.id, supabase])

  const loadPurchaseOrders = useCallback(async () => {
    setLoadingPOs(true)
    const { data } = await supabase
      .from('tt_purchase_orders')
      .select('*')
      .ilike('supplier_name', `%${supplier.name}%`)
      .order('created_at', { ascending: false })
      .limit(30)
    setPurchaseOrders(data || [])
    setLoadingPOs(false)
  }, [supplier.name, supabase])

  useEffect(() => { loadContacts(); loadPurchaseOrders() }, [loadContacts, loadPurchaseOrders])

  function startEditing() {
    setEditing(true)
    setEditData({
      name: supplier.name,
      legal_name: supplier.legal_name,
      tax_id: supplier.tax_id,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      country: supplier.country,
      category: supplier.category,
      payment_terms: supplier.payment_terms,
      notes: supplier.notes,
    })
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('tt_suppliers').update({
      name: editData.name,
      legal_name: editData.legal_name,
      tax_id: editData.tax_id,
      email: editData.email,
      phone: editData.phone,
      address: editData.address,
      city: editData.city,
      country: editData.country,
      category: editData.category,
      payment_terms: editData.payment_terms,
      notes: editData.notes,
    }).eq('id', supplier.id)
    if (!error) { setEditing(false); addToast({ type: 'success', title: 'Proveedor actualizado' }); onUpdate() }
    else addToast({ type: 'error', title: 'Error', message: error.message })
    setSaving(false)
  }

  async function addContact() {
    if (!newContact.name.trim()) { addToast({ type: 'error', title: 'El nombre es obligatorio' }); return }
    setSavingContact(true)
    const { error } = await supabase.from('tt_supplier_contacts').insert({
      supplier_id: supplier.id, name: newContact.name, position: newContact.position || null,
      email: newContact.email || null, phone: newContact.phone || null, whatsapp: newContact.whatsapp || null,
      is_primary: contacts.length === 0,
    })
    if (!error) { setShowAddContact(false); setNewContact({ name: '', position: '', email: '', phone: '', whatsapp: '' }); addToast({ type: 'success', title: 'Contacto agregado' }); loadContacts() }
    else addToast({ type: 'error', title: 'Error', message: error.message })
    setSavingContact(false)
  }

  async function saveContactEdit(contactId: string) {
    await supabase.from('tt_supplier_contacts').update({
      name: editContactData.name, position: editContactData.position || null,
      email: editContactData.email || null, phone: editContactData.phone || null,
      whatsapp: editContactData.whatsapp || null,
    }).eq('id', contactId)
    setEditingContact(null); addToast({ type: 'success', title: 'Contacto actualizado' }); loadContacts()
  }

  async function deleteContact(contactId: string) {
    await supabase.from('tt_supplier_contacts').delete().eq('id', contactId)
    addToast({ type: 'success', title: 'Contacto eliminado' }); loadContacts()
  }

  async function togglePrimary(contactId: string) {
    for (const c of contacts) {
      await supabase.from('tt_supplier_contacts').update({ is_primary: c.id === contactId }).eq('id', c.id)
    }
    addToast({ type: 'success', title: 'Contacto principal actualizado' }); loadContacts()
  }

  const totalSpend = purchaseOrders.reduce((s, po) => s + ((po.total as number) || 0), 0)
  const pendingPOs = purchaseOrders.filter(po => po.status === 'sent' || po.status === 'partial')

  const detailTabs = [
    { id: 'datos', label: 'Datos' },
    { id: 'contactos', label: `Contactos (${contacts.length})` },
    { id: 'historial', label: `Historial (${purchaseOrders.length})` },
    { id: 'productos', label: 'Productos' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex bg-[#0B0E13]/95 backdrop-blur-sm animate-in fade-in duration-200">
      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-[#141820] border-b border-[#1E2330] flex items-center px-4 gap-4 z-10">
        <button onClick={onClose} className="flex items-center gap-2 text-[#9CA3AF] hover:text-[#F0F2F5] transition-colors">
          <ArrowLeft size={18} /><span className="text-sm">Volver</span>
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
            <Building2 size={16} className="text-[#F59E0B]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#F0F2F5] leading-tight">{supplier.legal_name || supplier.name}</h1>
            <p className="text-xs text-[#6B7280]">{countryFlags[supplier.country || ''] || ''} {supplier.tax_id || 'Sin CIF/NIF'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {supplier.phone && <a href={`tel:${supplier.phone}`}><Button variant="ghost" size="sm"><Phone size={14} /></Button></a>}
          {supplier.email && <a href={`mailto:${supplier.email}`}><Button variant="ghost" size="sm"><Mail size={14} /></Button></a>}
          {supplier.phone && <a href={`https://wa.me/${supplier.phone.replace(/[^0-9+]/g, '')}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><MessageSquare size={14} /></Button></a>}
        </div>
      </div>

      <div className="flex flex-1 pt-14 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-72 border-r border-[#1E2330] overflow-y-auto p-4 space-y-4 shrink-0 hidden lg:block">
          <Card>
            <div className="space-y-3">
              <div className="w-14 h-14 rounded-xl bg-[#F59E0B]/20 flex items-center justify-center mx-auto">
                <span className="text-xl font-bold text-[#F59E0B]">{getInitials(supplier.legal_name || supplier.name)}</span>
              </div>
              <h2 className="text-center text-sm font-bold text-[#F0F2F5]">{supplier.legal_name || supplier.name}</h2>
              {supplier.tax_id && <p className="text-center text-xs font-mono text-[#9CA3AF]">{supplier.tax_id}</p>}
              <div className="pt-2 border-t border-[#1E2330] space-y-2">
                {supplier.address && <div className="flex items-start gap-2 text-xs text-[#9CA3AF]"><MapPin size={12} className="mt-0.5 shrink-0" /><span>{supplier.address}{supplier.city ? `, ${supplier.city}` : ''}</span></div>}
                {supplier.phone && <div className="flex items-center gap-2 text-xs text-[#9CA3AF]"><Phone size={12} className="shrink-0" /><span>{supplier.phone}</span></div>}
                {supplier.email && <div className="flex items-center gap-2 text-xs text-[#9CA3AF]"><Mail size={12} className="shrink-0" /><span className="truncate">{supplier.email}</span></div>}
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF]"><Globe size={12} className="shrink-0" /><span>{countryFlags[supplier.country || ''] || ''} {countryNames[supplier.country || ''] || supplier.country || '-'}</span></div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">Condiciones</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span className="text-[#6B7280]">Pago</span><span className="text-[#F0F2F5]">{supplier.payment_terms || '-'}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[#6B7280]">Categoria</span><span className="text-[#F0F2F5] capitalize">{supplier.category || '-'}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[#6B7280]">Origen</span><span className="text-[#F0F2F5]">{supplier.source || '-'}</span></div>
            </div>
          </Card>

          <Card>
            <h3 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">Acciones rapidas</h3>
            <div className="grid grid-cols-2 gap-2">
              {supplier.phone && <a href={`tel:${supplier.phone}`}><Button variant="secondary" size="sm" className="w-full text-xs"><Phone size={12} /> Llamar</Button></a>}
              {supplier.email && <a href={`mailto:${supplier.email}`}><Button variant="secondary" size="sm" className="w-full text-xs"><Mail size={12} /> Email</Button></a>}
              {supplier.phone && <a href={`https://wa.me/${supplier.phone.replace(/[^0-9+]/g, '')}`} target="_blank" rel="noreferrer"><Button variant="secondary" size="sm" className="w-full text-xs"><MessageSquare size={12} /> WhatsApp</Button></a>}
            </div>
          </Card>
        </div>

        {/* CENTER PANEL */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-1 p-1 bg-[#0F1218] rounded-lg border border-[#1E2330] mb-4 overflow-x-auto">
            {detailTabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveDetailTab(tab.id)} className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeDetailTab === tab.id ? 'bg-[#1E2330] text-[#FF6600] shadow-sm' : 'text-[#6B7280] hover:text-[#9CA3AF]'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB: Datos */}
          {activeDetailTab === 'datos' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-[#F0F2F5]">Datos del proveedor</h3>
                {!editing && <Button variant="secondary" size="sm" onClick={startEditing}><Edit3 size={14} /> Editar</Button>}
              </div>
              {editing ? (
                <Card>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Nombre comercial *" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                      <Input label="Razon social" value={editData.legal_name || ''} onChange={(e) => setEditData({ ...editData, legal_name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="CIF / NIF" value={editData.tax_id || ''} onChange={(e) => setEditData({ ...editData, tax_id: e.target.value })} />
                      <Select label="Categoria" value={editData.category || ''} onChange={(e) => setEditData({ ...editData, category: e.target.value })} options={[{ value: '', label: 'Sin categoria' }, { value: 'fabricante', label: 'Fabricante' }, { value: 'distribuidor', label: 'Distribuidor' }, { value: 'transporte', label: 'Transporte' }, { value: 'servicios', label: 'Servicios' }]} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Email" type="email" value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                      <Input label="Telefono" value={editData.phone || ''} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
                    </div>
                    <Input label="Direccion" value={editData.address || ''} onChange={(e) => setEditData({ ...editData, address: e.target.value })} />
                    <div className="grid grid-cols-3 gap-4">
                      <Input label="Ciudad" value={editData.city || ''} onChange={(e) => setEditData({ ...editData, city: e.target.value })} />
                      <Select label="Pais" value={editData.country || 'ES'} onChange={(e) => setEditData({ ...editData, country: e.target.value })} options={Object.entries(countryNames).map(([k, v]) => ({ value: k, label: v }))} />
                      <Input label="Condiciones de pago" value={editData.payment_terms || ''} onChange={(e) => setEditData({ ...editData, payment_terms: e.target.value })} />
                    </div>
                    <Input label="Notas" value={editData.notes || ''} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
                      <Button variant="primary" onClick={saveEdit} loading={saving}><Save size={14} /> Guardar</Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SupplierInfoField label="Nombre comercial" value={supplier.name} />
                  <SupplierInfoField label="Razon social" value={supplier.legal_name} />
                  <SupplierInfoField label="CIF / NIF" value={supplier.tax_id} mono />
                  <SupplierInfoField label="Categoria" value={supplier.category} />
                  <SupplierInfoField label="Email" value={supplier.email} />
                  <SupplierInfoField label="Telefono" value={supplier.phone} />
                  <SupplierInfoField label="Direccion" value={[supplier.address, supplier.city].filter(Boolean).join(', ')} />
                  <SupplierInfoField label="Pais" value={`${countryFlags[supplier.country || ''] || ''} ${countryNames[supplier.country || ''] || supplier.country}`} />
                  <SupplierInfoField label="Condiciones de pago" value={supplier.payment_terms} />
                  <SupplierInfoField label="Notas" value={supplier.notes} />
                </div>
              )}
            </div>
          )}

          {/* TAB: Contactos */}
          {activeDetailTab === 'contactos' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-[#F0F2F5]">Contactos de {supplier.name}</h3>
                <Button variant="primary" size="sm" onClick={() => setShowAddContact(true)}><Plus size={14} /> Agregar contacto</Button>
              </div>
              {loadingContacts ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FF6600]" size={24} /></div>
              ) : contacts.length === 0 ? (
                <Card><p className="text-center text-[#6B7280] py-6">No hay contactos registrados</p></Card>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <Card key={contact.id}>
                      {editingContact === contact.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <Input label="Nombre" value={editContactData.name || ''} onChange={(e) => setEditContactData({ ...editContactData, name: e.target.value })} />
                            <Input label="Cargo" value={editContactData.position || ''} onChange={(e) => setEditContactData({ ...editContactData, position: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <Input label="Email" value={editContactData.email || ''} onChange={(e) => setEditContactData({ ...editContactData, email: e.target.value })} />
                            <Input label="Telefono" value={editContactData.phone || ''} onChange={(e) => setEditContactData({ ...editContactData, phone: e.target.value })} />
                            <Input label="WhatsApp" value={editContactData.whatsapp || ''} onChange={(e) => setEditContactData({ ...editContactData, whatsapp: e.target.value })} />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="secondary" size="sm" onClick={() => setEditingContact(null)}>Cancelar</Button>
                            <Button variant="primary" size="sm" onClick={() => saveContactEdit(contact.id)}><Save size={12} /> Guardar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1E2330] flex items-center justify-center text-sm font-bold text-[#F59E0B] shrink-0">
                            {getInitials(contact.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[#F0F2F5]">{contact.name}</span>
                              {contact.is_primary && <Badge variant="orange" size="sm">Principal</Badge>}
                            </div>
                            {contact.position && <p className="text-xs text-[#6B7280]">{contact.position}</p>}
                            <div className="flex gap-4 mt-1 flex-wrap">
                              {contact.email && <span className="text-xs text-[#9CA3AF] flex items-center gap-1"><Mail size={10} />{contact.email}</span>}
                              {contact.phone && <span className="text-xs text-[#9CA3AF] flex items-center gap-1"><Phone size={10} />{contact.phone}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {!contact.is_primary && <Button variant="ghost" size="sm" onClick={() => togglePrimary(contact.id)} title="Marcar como principal"><Star size={14} /></Button>}
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditingContact(contact.id)
                              setEditContactData({ name: contact.name, position: contact.position, email: contact.email, phone: contact.phone, whatsapp: contact.whatsapp })
                            }}><Edit3 size={14} /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteContact(contact.id)}><Trash2 size={14} className="text-red-400" /></Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
              <Modal isOpen={showAddContact} onClose={() => setShowAddContact(false)} title="Agregar contacto" size="md">
                <div className="space-y-4">
                  <Input label="Nombre *" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
                  <Input label="Cargo / Posicion" value={newContact.position} onChange={(e) => setNewContact({ ...newContact, position: e.target.value })} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Email" type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
                    <Input label="Telefono" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                  </div>
                  <Input label="WhatsApp" value={newContact.whatsapp} onChange={(e) => setNewContact({ ...newContact, whatsapp: e.target.value })} />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setShowAddContact(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={addContact} loading={savingContact}><Save size={14} /> Guardar</Button>
                  </div>
                </div>
              </Modal>
            </div>
          )}

          {/* TAB: Historial */}
          {activeDetailTab === 'historial' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#F0F2F5]">Ordenes de compra</h3>
              {loadingPOs ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FF6600]" size={24} /></div>
              ) : purchaseOrders.length === 0 ? (
                <Card><p className="text-center text-[#6B7280] py-6">No hay ordenes de compra para este proveedor</p></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {purchaseOrders.map((po) => {
                    const st = (po.status as string) || 'draft'
                    return (
                      <DocumentListCard
                        key={po.id as string} type="pap"
                        systemCode={`PAP-${(po.id as string).slice(0, 8).toUpperCase()}`}
                        clientName={(po.supplier_name as string) || 'Sin proveedor'}
                        date={po.created_at ? formatDate(po.created_at as string) : '-'}
                        total={(po.total as number) || 0} currency="EUR"
                        status={st} statusLabel={PO_STATUS[st]?.label || st}
                        onClick={() => {}}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: Productos */}
          {activeDetailTab === 'productos' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#F0F2F5]">Productos suministrados</h3>
              <Card><p className="text-center text-[#6B7280] py-6">Vinculacion de productos por proveedor disponible proximamente</p></Card>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="w-72 border-l border-[#1E2330] overflow-y-auto p-4 space-y-4 shrink-0 hidden xl:block">
          <Card>
            <h3 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">Resumen</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><ShoppingCart size={14} className="text-blue-400" /></div>
                <div><p className="text-xs text-[#6B7280]">Ordenes de compra</p><p className="text-sm font-semibold text-[#F0F2F5]">{purchaseOrders.length}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><DollarSign size={14} className="text-emerald-400" /></div>
                <div><p className="text-xs text-[#6B7280]">Total compras</p><p className="text-sm font-semibold text-[#F0F2F5]">{formatCurrency(totalSpend)}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><Contact size={14} className="text-orange-400" /></div>
                <div><p className="text-xs text-[#6B7280]">Contactos</p><p className="text-sm font-semibold text-[#F0F2F5]">{contacts.length}</p></div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">Pedidos pendientes</h3>
            {pendingPOs.length === 0 ? (
              <p className="text-xs text-[#4B5563]">Sin pendientes</p>
            ) : (
              <div className="space-y-2">
                {pendingPOs.slice(0, 5).map(po => (
                  <div key={po.id as string} className="flex items-center justify-between p-2 rounded-lg bg-[#0F1218]">
                    <span className="text-xs font-mono text-[#FF6600]">PAP-{(po.id as string).slice(0, 8).toUpperCase()}</span>
                    <Badge variant="warning" size="sm">{PO_STATUS[(po.status as string)]?.label || (po.status as string)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-xs font-semibold text-[#6B7280] uppercase mb-3">Ultimas compras</h3>
            {purchaseOrders.length === 0 ? (
              <p className="text-xs text-[#4B5563]">Sin compras</p>
            ) : (
              <div className="space-y-2">
                {purchaseOrders.slice(0, 5).map(po => (
                  <div key={po.id as string} className="flex items-center justify-between p-2 rounded-lg bg-[#0F1218]">
                    <div>
                      <span className="text-xs font-mono text-[#FF6600]">PAP-{(po.id as string).slice(0, 8).toUpperCase()}</span>
                      <p className="text-[10px] text-[#4B5563]">{po.created_at ? formatDate(po.created_at as string) : '-'}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#F0F2F5]">{formatCurrency((po.total as number) || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function SupplierInfoField({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
      <p className="text-xs text-[#6B7280] mb-0.5">{label}</p>
      <p className={`text-sm text-[#F0F2F5] ${mono ? 'font-mono' : ''}`}>{value || '-'}</p>
    </div>
  )
}

// ===============================================================
// PROVEEDORES TAB (reads from tt_suppliers table)
// ===============================================================
function ProveedoresTab() {
  const supabase = createClient()
  const { addToast } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [countries, setCountries] = useState<string[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ name: '', legal_name: '', tax_id: '', category: '', country: 'ES', city: '', email: '', phone: '', address: '', payment_terms: '', notes: '' })
  const [savingNew, setSavingNew] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tt_suppliers').select('*').eq('active', true).order('name')
    const list = (data || []) as Supplier[]
    setSuppliers(list)
    const uniqueCountries = [...new Set(list.map(s => s.country).filter(Boolean) as string[])]
    uniqueCountries.sort()
    setCountries(uniqueCountries)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let result = suppliers
    if (filterCountry) result = result.filter(s => s.country === filterCountry)
    if (filterCategory) result = result.filter(s => s.category === filterCategory)
    if (search.trim()) {
      const tokens = search.trim().toLowerCase().split(/\s+/)
      result = result.filter(s => {
        const searchable = [s.name, s.legal_name, s.tax_id, s.email, s.city, s.phone, s.category].filter(Boolean).join(' ').toLowerCase()
        return tokens.every(t => searchable.includes(t))
      })
    }
    return result
  }, [suppliers, search, filterCountry, filterCategory])

  async function createNewSupplier() {
    if (!newSupplier.name.trim()) { addToast({ type: 'error', title: 'El nombre es obligatorio' }); return }
    setSavingNew(true)
    const { error } = await supabase.from('tt_suppliers').insert({
      name: newSupplier.name,
      legal_name: newSupplier.legal_name || null,
      tax_id: newSupplier.tax_id || null,
      category: newSupplier.category || null,
      country: newSupplier.country,
      city: newSupplier.city || null,
      email: newSupplier.email || null,
      phone: newSupplier.phone || null,
      address: newSupplier.address || null,
      payment_terms: newSupplier.payment_terms || null,
      notes: newSupplier.notes || null,
      active: true,
    })
    if (!error) {
      addToast({ type: 'success', title: 'Proveedor creado', message: newSupplier.name })
      setShowNew(false)
      setNewSupplier({ name: '', legal_name: '', tax_id: '', category: '', country: 'ES', city: '', email: '', phone: '', address: '', payment_terms: '', notes: '' })
      load()
    } else {
      addToast({ type: 'error', title: 'Error', message: error.message })
    }
    setSavingNew(false)
  }

  if (selectedSupplier) {
    return <SupplierDetail supplier={selectedSupplier} onClose={() => setSelectedSupplier(null)} onUpdate={() => { setSelectedSupplier(null); load() }} />
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Proveedores" value={filtered.length} icon={<Building2 size={22} />} />
        <KPICard label="Paises" value={countries.length} icon={<Globe size={22} />} />
        <KPICard label="Fabricantes" value={suppliers.filter(s => s.category === 'fabricante').length} icon={<Package size={22} />} color="#10B981" />
        <KPICard label="Con contactos" value={0} icon={<Contact size={22} />} />
      </div>

      {/* Actions + Export */}
      <div className="flex justify-end gap-2">
        <ExportButton
          data={filtered as unknown as Record<string, unknown>[]}
          filename="proveedores_torquetools"
          columns={[
            { key: 'name', label: 'Nombre' },
            { key: 'legal_name', label: 'Razon Social' },
            { key: 'tax_id', label: 'CIF/NIF' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Telefono' },
            { key: 'country', label: 'Pais' },
            { key: 'city', label: 'Ciudad' },
            { key: 'category', label: 'Categoria' },
            { key: 'payment_terms', label: 'Condiciones Pago' },
          ]}
        />
        <Button variant="primary" onClick={() => setShowNew(true)}><Plus size={16} /> Nuevo Proveedor</Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar placeholder="Buscar proveedor, CIF, email..." value={search} onChange={setSearch} className="flex-1 max-w-lg" />
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterCountry('')} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${!filterCountry ? 'bg-[#FF6600] text-white' : 'bg-[#1E2330] text-[#9CA3AF] hover:bg-[#2A3040]'}`}>Todos</button>
          {countries.slice(0, 8).map((country) => (
            <button key={country} onClick={() => setFilterCountry(filterCountry === country ? '' : country)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${filterCountry === country ? 'bg-[#FF6600] text-white' : 'bg-[#1E2330] text-[#9CA3AF] hover:bg-[#2A3040]'}`}>
              {countryFlags[country] || ''} {country}
            </button>
          ))}
        </div>
      </div>

      {/* Supplier List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#141820] border border-[#1E2330] p-5 animate-pulse">
              <div className="h-5 bg-[#1E2330] rounded w-40 mb-3" /><div className="h-3 bg-[#1E2330] rounded w-full mb-2" /><div className="h-3 bg-[#1E2330] rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#4B5563]">
          <Building2 size={48} className="mb-4" /><p className="text-lg font-medium">No se encontraron proveedores</p>
          <p className="text-sm mt-1">Proba con otros filtros o terminos de busqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((supplier) => (
            <Card key={supplier.id} hover onClick={() => setSelectedSupplier(supplier)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/15 flex items-center justify-center text-sm font-bold text-[#F59E0B] shrink-0">
                    {getInitials(supplier.legal_name || supplier.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#F0F2F5] truncate">{supplier.name}</h3>
                    {supplier.tax_id && <p className="text-xs font-mono text-[#6B7280] truncate">{supplier.tax_id}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-lg">{countryFlags[supplier.country || ''] || ''}</span>
                  <ChevronRight size={14} className="text-[#4B5563]" />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {supplier.email && <span className="text-xs text-[#9CA3AF] flex items-center gap-1"><Mail size={10} /><span className="truncate max-w-[140px]">{supplier.email}</span></span>}
                {supplier.phone && <span className="text-xs text-[#9CA3AF] flex items-center gap-1"><Phone size={10} />{supplier.phone}</span>}
              </div>
              <div className="pt-3 border-t border-[#1E2330] flex items-center justify-between">
                <div className="flex gap-1.5">
                  {supplier.category && <Badge variant="info" size="sm">{supplier.category}</Badge>}
                  {supplier.payment_terms && <Badge variant="default" size="sm">{supplier.payment_terms}</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* NEW SUPPLIER MODAL */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Nuevo Proveedor" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre comercial *" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} />
            <Input label="Razon social" value={newSupplier.legal_name} onChange={(e) => setNewSupplier({ ...newSupplier, legal_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="CIF / NIF" value={newSupplier.tax_id} onChange={(e) => setNewSupplier({ ...newSupplier, tax_id: e.target.value })} />
            <Select label="Categoria" value={newSupplier.category} onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })} options={[{ value: '', label: 'Sin categoria' }, { value: 'fabricante', label: 'Fabricante' }, { value: 'distribuidor', label: 'Distribuidor' }, { value: 'transporte', label: 'Transporte' }, { value: 'servicios', label: 'Servicios' }]} />
            <Select label="Pais" value={newSupplier.country} onChange={(e) => setNewSupplier({ ...newSupplier, country: e.target.value })} options={Object.entries(countryNames).map(([k, v]) => ({ value: k, label: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} />
            <Input label="Telefono" value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
          </div>
          <Input label="Direccion" value={newSupplier.address} onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ciudad" value={newSupplier.city} onChange={(e) => setNewSupplier({ ...newSupplier, city: e.target.value })} />
            <Input label="Condiciones de pago" value={newSupplier.payment_terms} onChange={(e) => setNewSupplier({ ...newSupplier, payment_terms: e.target.value })} />
          </div>
          <Input label="Notas" value={newSupplier.notes} onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2330]">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={createNewSupplier} loading={savingNew}>Crear Proveedor</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ===============================================================
// PEDIDOS COMPRA TAB
// ===============================================================
function PedidosCompraTab() {
  const supabase = createClient()
  const { addToast } = useToast()
  const [orders, setOrders] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [selectedPO, setSelectedPO] = useState<Row | null>(null)
  const [poItems, setPOItems] = useState<Row[]>([])
  const [supplier, setSupplier] = useState('')
  const [notesText, setNotesText] = useState('')
  const [lines, setLines] = useState<Array<{ product_id: string; name: string; quantity: number; unit_cost: number }>>([])
  const [products, setProducts] = useState<Array<Row>>([])
  const [saving, setSaving] = useState(false)
  const [rcvLines, setRcvLines] = useState<Array<{ id: string; desc: string; ordered: number; received: number; toReceive: number }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('tt_purchase_orders').select('*').order('created_at', { ascending: false })
    if (statusFilter) q = q.eq('status', statusFilter)
    if (search) q = q.ilike('supplier_name', `%${search}%`)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }, [supabase, statusFilter, search])

  useEffect(() => { load() }, [load])

  const loadProducts = async () => {
    const { data } = await supabase.from('tt_products').select('id, sku, name, cost_eur').order('name').limit(500)
    setProducts(data || [])
  }

  const handleCreate = async () => {
    if (!supplier.trim() || lines.length === 0) { addToast({ type: 'warning', title: 'Completa los datos' }); return }
    setSaving(true)
    const total = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0)
    const { data: po, error } = await supabase.from('tt_purchase_orders').insert({ supplier_name: supplier, status: 'draft', total, notes: notesText }).select().single()
    if (error || !po) { addToast({ type: 'error', title: 'Error', message: error?.message }); setSaving(false); return }
    const items = lines.map((l, i) => ({ purchase_order_id: po.id, product_id: l.product_id || null, description: l.name, quantity: l.quantity, unit_cost: l.unit_cost, qty_received: 0, line_total: l.quantity * l.unit_cost, sort_order: i }))
    await supabase.from('tt_po_items').insert(items)
    addToast({ type: 'success', title: 'OC creada' })
    setShowCreate(false); setSupplier(''); setNotesText(''); setLines([]); load(); setSaving(false)
  }

  const openDetail = async (po: Row) => {
    setSelectedPO(po)
    const { data } = await supabase.from('tt_po_items').select('*').eq('purchase_order_id', po.id).order('sort_order')
    setPOItems(data || [])
  }

  const openReceive = async (po: Row) => {
    setSelectedPO(po)
    const { data } = await supabase.from('tt_po_items').select('*').eq('purchase_order_id', po.id).order('sort_order')
    setRcvLines((data || []).map((it: Row) => ({ id: it.id as string, desc: (it.description || '') as string, ordered: (it.quantity || 0) as number, received: (it.qty_received || 0) as number, toReceive: 0 })))
    setShowReceive(true)
  }

  const handleReceive = async () => {
    if (!selectedPO) return
    for (const l of rcvLines) { if (l.toReceive > 0) { await supabase.from('tt_po_items').update({ qty_received: l.received + l.toReceive }).eq('id', l.id) } }
    const { data: items } = await supabase.from('tt_po_items').select('quantity, qty_received').eq('purchase_order_id', selectedPO.id)
    const allDone = (items || []).every((i: Row) => (i.qty_received as number) >= (i.quantity as number))
    const someDone = (items || []).some((i: Row) => (i.qty_received as number) > 0)
    const st = allDone ? 'received' : someDone ? 'partial' : (selectedPO.status as string)
    await supabase.from('tt_purchase_orders').update({ status: st }).eq('id', selectedPO.id)
    addToast({ type: 'success', title: 'Recepcion registrada' })
    setShowReceive(false); setSelectedPO(null); load()
  }

  const changeStatus = async (id: string, st: string) => {
    await supabase.from('tt_purchase_orders').update({ status: st }).eq('id', id)
    addToast({ type: 'success', title: 'Estado actualizado' })
    setSelectedPO(null); load()
  }

  // Detail view using DocumentDetailLayout
  if (selectedPO && !showReceive) {
    const st = (selectedPO.status as string) || 'draft'
    const supplierName = (selectedPO.supplier_name as string) || 'Sin proveedor'

    const totalOrdered = poItems.reduce((s, it) => s + ((it.quantity as number) || 0), 0)
    const totalReceived = poItems.reduce((s, it) => s + ((it.qty_received as number) || 0), 0)
    const receivedPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0

    const docItems: DocumentItem[] = poItems.map((it, idx) => {
      const ordered = (it.quantity as number) || 0
      const received = (it.qty_received as number) || 0
      const isDone = received >= ordered
      return {
        id: (it.id as string) || `pi-${idx}`,
        sku: (it.sku as string) || '',
        description: (it.description as string) || '',
        quantity: ordered,
        unit_price: (it.unit_cost as number) || 0,
        subtotal: (it.line_total as number) || 0,
        qty_delivered: received,
        qty_invoiced: 0, qty_reserved: 0,
        status: isDone ? 'completed' : received > 0 ? 'partial' : 'pending',
        statusColor: isDone ? '#00C853' : received > 0 ? '#FFB300' : '#6B7280',
        statusLabel: isDone ? 'Recibido' : received > 0 ? 'Parcial' : 'Pendiente',
        stockAvailable: 0, stockReserved: 0, stockIndicator: 'ok' as const,
        requires_po: false, hasComponents: false,
      }
    })

    const alerts = st === 'sent' && selectedPO.created_at ? (() => {
      const daysSince = Math.floor((Date.now() - new Date(selectedPO.created_at as string).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince > 14) return [{
        id: 'overdue-alert', type: 'po_overdue', severity: 'warning' as const,
        title: `OC enviada hace ${daysSince} dias sin confirmacion`,
        description: `Verificar con ${supplierName} el estado del envio.`,
        status: 'active',
      }]
      return []
    })() : []

    const actionButtons = (
      <div className="flex gap-2 mt-4">
        {st === 'draft' && (
          <Button variant="secondary" onClick={() => changeStatus(selectedPO.id as string, 'sent')}><Send size={14} /> Marcar Enviada</Button>
        )}
        {(st === 'sent' || st === 'partial') && (
          <Button variant="secondary" onClick={() => openReceive(selectedPO)}><Truck size={14} /> Registrar Recepcion</Button>
        )}
        {st === 'received' && (
          <Button variant="secondary" onClick={() => changeStatus(selectedPO.id as string, 'closed')}><CheckCircle size={14} /> Cerrar OC</Button>
        )}
      </div>
    )

    return (
      <DocumentDetailLayout
        workflowSteps={buildPOWorkflow(selectedPO)}
        document={{
          id: selectedPO.id as string, type: 'pap',
          system_code: `PAP-${(selectedPO.id as string).slice(0, 8).toUpperCase()}`,
          display_ref: `Compra ${supplierName}`,
          status: st, currency: 'EUR',
          total: (selectedPO.total as number) || 0,
          subtotal: (selectedPO.total as number) || 0,
          tax_amount: 0,
          created_at: (selectedPO.created_at as string) || new Date().toISOString(),
        }}
        alerts={alerts}
        deliveryProgress={{
          clientName: supplierName,
          deliveredPct: receivedPct,
          invoicedPct: 0, collectedPct: 0,
          ocRef: supplierName,
          itemStatuses: docItems.map((i) => ({ label: i.statusLabel, color: i.statusColor })),
        }}
        trackingSummary={[
          { label: 'Proveedor', value: supplierName, color: '#F0F2F5' },
          { label: 'Items', value: poItems.length, color: '#F0F2F5' },
          { label: 'Recibido', value: `${receivedPct}%`, color: receivedPct >= 100 ? '#00C853' : '#FFB300' },
        ]}
        overallProgress={receivedPct}
        notes={[]}
        onAddNote={() => {}}
        onBack={() => setSelectedPO(null)}
        backLabel="Volver a pedidos de compra"
      >
        <DocumentItemsTree items={docItems} components={[]} showStock={false} />
        {actionButtons}
      </DocumentDetailLayout>
    )
  }

  const totalPOs = orders.length
  const draftCount = orders.filter(o => o.status === 'draft').length
  const pendingCount = orders.filter(o => o.status === 'sent' || o.status === 'partial').length
  const totalVal = orders.reduce((s, o) => s + ((o.total as number) || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <ExportButton
          data={orders as Record<string, unknown>[]}
          filename="ordenes_compra_torquetools"
          columns={[
            { key: 'supplier_name', label: 'Proveedor' },
            { key: 'status', label: 'Estado' },
            { key: 'total', label: 'Total' },
            { key: 'notes', label: 'Notas' },
            { key: 'created_at', label: 'Fecha' },
          ]}
        />
        <Button onClick={() => { setShowCreate(true); loadProducts() }}><Plus size={16} /> Nueva OC</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total OCs" value={totalPOs} icon={<ShoppingCart size={22} />} />
        <KPICard label="Borradores" value={draftCount} icon={<FileText size={22} />} color="#6B7280" />
        <KPICard label="Pendientes" value={pendingCount} icon={<Clock size={22} />} color="#F59E0B" />
        <KPICard label="Valor total" value={formatCurrency(totalVal)} icon={<Package size={22} />} color="#10B981" />
      </div>
      <div className="bg-[#141820] rounded-xl border border-[#2A3040] p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar placeholder="Buscar proveedor..." value={search} onChange={setSearch} className="flex-1" />
          <Select options={[{ value: '', label: 'Todos' }, ...Object.entries(PO_STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[#FF6600]" size={32} /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-[#6B7280]"><ShoppingCart size={48} className="mx-auto mb-3 opacity-30" /><p>No hay ordenes de compra</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {orders.map((po) => {
            const st = (po.status as string) || 'draft'
            return (
              <DocumentListCard
                key={po.id as string} type="pap"
                systemCode={`PAP-${(po.id as string).slice(0, 8).toUpperCase()}`}
                clientName={(po.supplier_name as string) || 'Sin proveedor'}
                date={po.created_at ? formatDate(po.created_at as string) : '-'}
                total={(po.total as number) || 0} currency="EUR"
                status={st} statusLabel={PO_STATUS[st]?.label || st}
                onClick={() => openDetail(po)}
              />
            )
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nueva Orden de Compra" size="xl">
        <div className="space-y-4">
          <Input label="Proveedor" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nombre del proveedor" />
          <div>
            <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-[#9CA3AF]">Productos</span><Button variant="ghost" size="sm" onClick={() => setLines([...lines, { product_id: '', name: '', quantity: 1, unit_cost: 0 }])}><Plus size={14} /> Agregar</Button></div>
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2 mb-2 items-end">
                <div className="flex-1"><Select options={products.map(p => ({ value: p.id as string, label: `${p.sku || ''} - ${p.name}` }))} value={l.product_id} onChange={(e) => { const u = [...lines]; const p = products.find(pr => pr.id === e.target.value); if (p) { u[i] = { ...u[i], product_id: p.id as string, name: (p.name || '') as string, unit_cost: (p.cost_eur || 0) as number } }; setLines(u) }} placeholder="Producto" /></div>
                <Input type="number" value={l.quantity} onChange={(e) => { const u = [...lines]; u[i].quantity = Number(e.target.value); setLines(u) }} className="w-20" />
                <Input type="number" value={l.unit_cost} onChange={(e) => { const u = [...lines]; u[i].unit_cost = Number(e.target.value); setLines(u) }} className="w-28" />
                <Button variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><X size={14} /></Button>
              </div>
            ))}
          </div>
          <Input label="Notas" value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder="Observaciones..." />
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2330]"><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button><Button onClick={handleCreate} loading={saving}>Crear OC</Button></div>
        </div>
      </Modal>

      {/* RECEIVE MODAL */}
      <Modal isOpen={showReceive} onClose={() => setShowReceive(false)} title="Recepcion de Mercaderia" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-[#6B7280]">Ingresa las cantidades recibidas para cada producto</p>
          {rcvLines.map((l, i) => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0F1218]">
              <div className="flex-1"><p className="text-sm text-[#F0F2F5]">{l.desc}</p><p className="text-xs text-[#6B7280]">Pedido: {l.ordered} | Recibido: {l.received} | Pend: {l.ordered - l.received}</p></div>
              <Input type="number" value={l.toReceive} onChange={(e) => { const u = [...rcvLines]; u[i].toReceive = Math.max(0, Math.min(Number(e.target.value), l.ordered - l.received)); setRcvLines(u) }} className="w-24" />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2330]"><Button variant="secondary" onClick={() => setShowReceive(false)}>Cancelar</Button><Button onClick={handleReceive}><CheckCircle size={16} /> Confirmar</Button></div>
        </div>
      </Modal>
    </div>
  )
}

// ===============================================================
// RECEPCIONES TAB
// ===============================================================
function RecepcionesTab() {
  const supabase = createClient()
  const [receptions, setReceptions] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('tt_purchase_orders').select('*').in('status', ['partial', 'received']).order('updated_at', { ascending: false })
      setReceptions(data || [])
      setLoading(false)
    })()
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard label="Recepciones" value={receptions.length} icon={<Truck size={22} />} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[#FF6600]" size={32} /></div>
      ) : receptions.length === 0 ? (
        <div className="text-center py-20 text-[#6B7280]"><Truck size={48} className="mx-auto mb-3 opacity-30" /><p>No hay recepciones registradas</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {receptions.map((r) => {
            const st = (r.status as string) || 'partial'
            return (
              <DocumentListCard
                key={r.id as string} type="recepcion"
                systemCode={`REC-${(r.id as string).slice(0, 8).toUpperCase()}`}
                clientName={(r.supplier_name as string) || 'Sin proveedor'}
                date={r.updated_at ? formatDate(r.updated_at as string) : '-'}
                total={(r.total as number) || 0} currency="EUR"
                status={st} statusLabel={st === 'received' ? 'Completa' : 'Parcial'}
                onClick={() => {}}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ===============================================================
// FACTURAS COMPRA TAB
// ===============================================================
function FacturasCompraTab() {
  const supabase = createClient()
  const [invoices, setInvoices] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('tt_invoices').select('*').eq('type', 'purchase').order('created_at', { ascending: false })
    if (search) q = q.ilike('doc_number', `%${search}%`)
    const { data } = await q
    setInvoices(data || [])
    setLoading(false)
  }, [supabase, search])

  useEffect(() => { load() }, [load])

  const totalAmount = invoices.reduce((s, i) => s + ((i.total as number) || 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard label="Facturas de compra" value={invoices.length} icon={<FileCheck size={22} />} />
        <KPICard label="Monto total" value={formatCurrency(totalAmount)} icon={<DollarSign size={22} />} color="#EF4444" />
      </div>
      <div className="bg-[#141820] rounded-xl border border-[#2A3040] p-3 flex gap-3 items-center">
        <SearchBar placeholder="Buscar factura de compra..." value={search} onChange={setSearch} className="flex-1" />
        <ExportButton
          data={invoices as Record<string, unknown>[]}
          filename="facturas_compra_torquetools"
          columns={[
            { key: 'doc_number', label: 'Numero' },
            { key: 'status', label: 'Estado' },
            { key: 'total', label: 'Total' },
            { key: 'created_at', label: 'Fecha' },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[#FF6600]" size={32} /></div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 text-[#6B7280]"><FileCheck size={48} className="mx-auto mb-3 opacity-30" /><p>No hay facturas de compra</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {invoices.map((inv) => {
            const st = (inv.status as string) || 'pending'
            return (
              <DocumentListCard
                key={inv.id as string} type="factura_compra"
                systemCode={(inv.doc_number as string) || '-'}
                clientName="Factura proveedor"
                date={inv.created_at ? formatDate(inv.created_at as string) : '-'}
                total={(inv.total as number) || 0} currency="EUR"
                status={st} statusLabel={st === 'paid' ? 'Pagada' : st}
                onClick={() => {}}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ===============================================================
// MAIN PAGE
// ===============================================================
export default function ComprasPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#F0F2F5]">Compras</h1>
        <p className="text-sm text-[#6B7280] mt-1">Proveedores, ordenes de compra, recepciones y facturas</p>
      </div>
      <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FF6600]" size={32} /></div>}>
        <Tabs tabs={comprasTabs} defaultTab="proveedores">
          {(activeTab) => (
            <>
              {activeTab === 'proveedores' && <ProveedoresTab />}
              {activeTab === 'pedidos' && <PedidosCompraTab />}
              {activeTab === 'recepciones' && <RecepcionesTab />}
              {activeTab === 'facturas' && <FacturasCompraTab />}
            </>
          )}
        </Tabs>
      </Suspense>
    </div>
  )
}
