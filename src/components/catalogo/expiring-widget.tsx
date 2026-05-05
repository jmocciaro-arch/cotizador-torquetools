'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Calendar, Wrench } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { listExpiringSoon, type ExpiringLot } from '@/lib/product-lots'
import { listCalibrationDue, type CalibrationDueSerial } from '@/lib/product-serials'

/**
 * Widget para mostrar conteos en la cabecera del catálogo.
 * - Lotes vencen en X días
 * - Series con calibración próxima
 * Click → modal con detalle.
 */
export function ExpiringWidget({ daysAhead = 30 }: { daysAhead?: number }) {
  const [lotsCount, setLotsCount] = useState<number | null>(null)
  const [serialsCount, setSerialsCount] = useState<number | null>(null)
  const [showLots, setShowLots] = useState(false)
  const [showSerials, setShowSerials] = useState(false)
  const [lots, setLots] = useState<ExpiringLot[]>([])
  const [serials, setSerials] = useState<CalibrationDueSerial[]>([])

  const reload = useCallback(async () => {
    const [l, s] = await Promise.all([
      listExpiringSoon(daysAhead),
      listCalibrationDue(daysAhead),
    ])
    setLots(l); setLotsCount(l.length)
    setSerials(s); setSerialsCount(s.length)
  }, [daysAhead])

  useEffect(() => { reload() }, [reload])

  // Si ambos son null o cero, no mostramos nada (defensivo: tablas no existen → null).
  if ((lotsCount ?? 0) === 0 && (serialsCount ?? 0) === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(lotsCount ?? 0) > 0 && (
        <button
          onClick={() => setShowLots(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
        >
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="text-xs text-amber-400 font-medium">
            {lotsCount} lote{lotsCount === 1 ? '' : 's'} a vencer
          </span>
        </button>
      )}
      {(serialsCount ?? 0) > 0 && (
        <button
          onClick={() => setShowSerials(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
        >
          <Wrench size={14} className="text-blue-400" />
          <span className="text-xs text-blue-400 font-medium">
            {serialsCount} calibración{serialsCount === 1 ? '' : 'es'} próxima{serialsCount === 1 ? '' : 's'}
          </span>
        </button>
      )}

      <Modal isOpen={showLots} onClose={() => setShowLots(false)} title={`Lotes que vencen en los próximos ${daysAhead} días`} size="lg">
        {lots.length === 0 ? (
          <p className="text-sm text-[#9CA3AF]">No hay lotes próximos a vencer.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0A0D12] text-[#6B7280] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">Lote</th>
                  <th className="px-3 py-2 text-left">Vence</th>
                  <th className="px-3 py-2 text-right">Días</th>
                  <th className="px-3 py-2 text-right">Restante</th>
                </tr>
              </thead>
              <tbody>
                {lots.map(l => (
                  <tr key={l.lot_id} className="border-t border-[#1E2330]">
                    <td className="px-3 py-2"><span className="font-medium text-[#F0F2F5]">{l.product_sku}</span> <span className="text-[#9CA3AF]">{l.product_name}</span></td>
                    <td className="px-3 py-2 font-mono text-[#9CA3AF]">{l.lot_number}</td>
                    <td className="px-3 py-2 text-[#9CA3AF]">{l.expiry_date}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={l.days_until_expiry < 0 ? 'danger' : l.days_until_expiry <= 7 ? 'danger' : 'warning'} size="sm">
                        {l.days_until_expiry < 0 ? `${Math.abs(l.days_until_expiry)}d vencido` : `${l.days_until_expiry}d`}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-[#F0F2F5]">{l.qty_remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal isOpen={showSerials} onClose={() => setShowSerials(false)} title={`Calibraciones próximas (${daysAhead} días)`} size="lg">
        {serials.length === 0 ? (
          <p className="text-sm text-[#9CA3AF]">No hay calibraciones próximas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0A0D12] text-[#6B7280] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">Serie</th>
                  <th className="px-3 py-2 text-left">Calibración</th>
                  <th className="px-3 py-2 text-right">Días</th>
                  <th className="px-3 py-2 text-left">Owner</th>
                </tr>
              </thead>
              <tbody>
                {serials.map(s => (
                  <tr key={s.serial_id} className="border-t border-[#1E2330]">
                    <td className="px-3 py-2"><span className="font-medium text-[#F0F2F5]">{s.product_sku}</span> <span className="text-[#9CA3AF]">{s.product_name}</span></td>
                    <td className="px-3 py-2 font-mono text-[#9CA3AF]">{s.serial_number}</td>
                    <td className="px-3 py-2 text-[#9CA3AF] flex items-center gap-1"><Calendar size={11} /> {s.next_calibration_date}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={s.days_until <= 7 ? 'danger' : 'warning'} size="sm">{s.days_until}d</Badge>
                    </td>
                    <td className="px-3 py-2 text-[#9CA3AF]">{s.current_owner_type || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
