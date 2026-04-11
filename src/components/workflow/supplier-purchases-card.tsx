'use client'

import { cn } from '@/lib/utils'
import { ShoppingCart, Clock, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'

export interface SupplierPurchase {
  id: string
  ref: string
  supplier: string
  status: string
  statusColor: string
  expectedArrival?: string
  isOverdue: boolean
  daysOverdue?: number
  total?: number
  currency?: string
  itemCount: number
}

interface SupplierPurchasesCardProps {
  purchases: SupplierPurchase[]
  onPurchaseClick?: (purchase: SupplierPurchase) => void
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={12} />,
  sent: <Clock size={12} />,
  confirmed: <CheckCircle2 size={12} />,
  partial: <Clock size={12} />,
  received: <CheckCircle2 size={12} />,
  overdue: <AlertTriangle size={12} />,
}

export function SupplierPurchasesCard({ purchases, onPurchaseClick }: SupplierPurchasesCardProps) {
  if (purchases.length === 0) return null

  return (
    <div className="bg-[#141820] rounded-xl border border-[#2A3040] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A3040]">
        <div className="flex items-center gap-2">
          <ShoppingCart size={14} className="text-[#F59E0B]" />
          <h3 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wide">
            Compras a proveedor
          </h3>
        </div>
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#F59E0B]/20 text-[#F59E0B] min-w-[18px] text-center">
          {purchases.length}
        </span>
      </div>

      {/* Purchases list */}
      <div className="divide-y divide-[#1E2330]">
        {purchases.map((purchase) => (
          <div
            key={purchase.id}
            className={cn(
              'group flex items-start gap-3 px-4 py-3 hover:bg-[#1C2230] transition-colors cursor-pointer',
              purchase.isOverdue && 'border-l-3 border-l-[#FF3D00]'
            )}
            onClick={() => onPurchaseClick?.(purchase)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#F0F2F5] font-mono">
                  {purchase.ref}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1"
                  style={{
                    background: `${purchase.statusColor}20`,
                    color: purchase.statusColor,
                  }}
                >
                  {statusIcons[purchase.status] || <Clock size={10} />}
                  {purchase.status.toUpperCase()}
                </span>
              </div>

              <p className="text-[10px] text-[#9CA3AF] mt-0.5">{purchase.supplier}</p>

              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-[#6B7280]">{purchase.itemCount} items</span>
                {purchase.expectedArrival && (
                  <span
                    className={cn(
                      'text-[10px] flex items-center gap-0.5',
                      purchase.isOverdue ? 'text-[#FF3D00] font-bold' : 'text-[#6B7280]'
                    )}
                  >
                    <Clock size={9} />
                    {purchase.isOverdue
                      ? `ATRASADO ${purchase.daysOverdue}d`
                      : `Llega: ${purchase.expectedArrival}`}
                  </span>
                )}
                {purchase.total && (
                  <span className="text-[10px] text-[#6B7280]">
                    {purchase.currency || 'EUR'} {purchase.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

            <ExternalLink
              size={12}
              className="text-[#6B7280] opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
