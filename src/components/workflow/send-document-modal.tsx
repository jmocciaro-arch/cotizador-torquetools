'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, MessageCircle, Copy, ExternalLink, Check } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface SendDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  documentType: string
  documentNumber: string
  clientName: string
  clientEmail?: string
  total: number
  currency: 'EUR' | 'ARS' | 'USD'
  items?: Array<{ description: string; quantity: number }>
  onSent?: () => void
}

export function SendDocumentModal({
  isOpen,
  onClose,
  documentType,
  documentNumber,
  clientName,
  clientEmail,
  total,
  currency,
  items,
  onSent,
}: SendDocumentModalProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email')
  const [emailTo, setEmailTo] = useState(clientEmail || '')
  const [emailSubject, setEmailSubject] = useState(`${documentType} ${documentNumber} - TORQUETOOLS`)
  const [copied, setCopied] = useState(false)

  const typeLabels: Record<string, string> = {
    coti: 'Cotizacion',
    pedido: 'Pedido de Venta',
    delivery_note: 'Albaran/Remito',
    factura: 'Factura',
  }

  const docLabel = typeLabels[documentType] || documentType

  const itemsSummary = items
    ? items.map((it) => `  - ${it.description} x${it.quantity}`).join('\n')
    : ''

  const messageBody = `Estimado/a ${clientName},

Le enviamos ${docLabel} ${documentNumber}.

${itemsSummary ? `Detalle:\n${itemsSummary}\n` : ''}Total: ${formatCurrency(total, currency)}

Quedamos a disposicion para cualquier consulta.

Saludos cordiales,
TORQUETOOLS`

  const whatsAppText = `${docLabel} ${documentNumber}\nCliente: ${clientName}\nTotal: ${formatCurrency(total, currency)}${
    items ? '\nItems: ' + items.length : ''
  }`

  const handleCopy = () => {
    navigator.clipboard.writeText(messageBody)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(emailTo)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(messageBody)}`
    window.open(gmailUrl, '_blank')
    onSent?.()
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsAppText)}`, '_blank')
    onSent?.()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Enviar ${docLabel}`} size="lg">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#0B0E13] rounded-lg border border-[#1E2330]">
          <button
            onClick={() => setActiveTab('email')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'email'
                ? 'bg-[#1E2330] text-[#FF6600]'
                : 'text-[#6B7280] hover:text-[#9CA3AF]'
            }`}
          >
            <Mail size={16} /> Email
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'whatsapp'
                ? 'bg-[#25D366]/20 text-[#25D366]'
                : 'text-[#6B7280] hover:text-[#9CA3AF]'
            }`}
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>

        {/* Email tab */}
        {activeTab === 'email' && (
          <div className="space-y-3">
            <Input
              label="Para"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="cliente@empresa.com"
              type="email"
            />
            <Input
              label="Asunto"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
                Mensaje
              </label>
              <div className="bg-[#0B0E13] border border-[#2A3040] rounded-lg p-3 text-sm text-[#9CA3AF] whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {messageBody}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleCopy} className="flex-1">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar al portapapeles'}
              </Button>
              <Button onClick={handleOpenGmail} className="flex-1">
                <ExternalLink size={14} /> Abrir Gmail
              </Button>
            </div>
          </div>
        )}

        {/* WhatsApp tab */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">
                Vista previa del mensaje
              </label>
              <div className="bg-[#0B0E13] border border-[#2A3040] rounded-lg p-4 text-sm text-[#F0F2F5] whitespace-pre-wrap">
                {whatsAppText}
              </div>
            </div>

            <Button
              onClick={handleWhatsApp}
              className="w-full !bg-[#25D366] hover:!bg-[#20BD5A]"
            >
              <MessageCircle size={16} /> Enviar por WhatsApp
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
