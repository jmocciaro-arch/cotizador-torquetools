'use client'

import { cn } from '@/lib/utils'
import { Warehouse, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface StockSnapshotItem {
  productId: string
  productName: string
  sku: string
  stockReal: number
  stockReserved: number
  stockAvailable: number
  stockInTransit: number
  assignedOrders: { ref: string; qty: number }[]
  indicator: 'ok' | 'low' | 'critical' | 'zero'
}

interface StockSnapshotCardProps {
  items: StockSnapshotItem[]
  warehouseName?: string
}

const indicatorColors = {
  ok: '#00C853',
  low: '#FFB300',
  critical: '#FF3D00',
  zero: '#6B7280',
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full h-1.5 bg-[#1E2330] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

export function StockSnapshotCard({ items, warehouseName }: StockSnapshotCardProps) {
  return (
    <div className="bg-[#141820] rounded-xl border border-[#2A3040] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A3040]">
        <div className="flex items-center gap-2">
          <Warehouse size={14} className="text-[#4285F4]" />
          <h3 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wide">
            Snapshot stock
          </h3>
        </div>
        {warehouseName && (
          <span className="text-[10px] text-[#6B7280]">{warehouseName}</span>
        )}
      </div>

      {/* Stock items */}
      <div className="divide-y divide-[#1E2330]">
        {items.map((item) => {
          const color = indicatorColors[item.indicator]
          const maxStock = Math.max(item.stockReal, item.stockReserved + item.stockAvailable + item.stockInTransit, 1)
          const trend = item.stockAvailable > item.stockReserved ? 'up' : item.stockAvailable < item.stockReserved ? 'down' : 'flat'

          return (
            <div key={item.productId} className="px-4 py-3">
              {/* Product name + mini bar */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-[#F0F2F5] truncate flex-1">
                  {item.productName}
                </span>
                {trend === 'up' && <TrendingUp size={10} className="text-[#00C853] shrink-0" />}
                {trend === 'down' && <TrendingDown size={10} className="text-[#FF3D00] shrink-0" />}
                {trend === 'flat' && <Minus size={10} className="text-[#6B7280] shrink-0" />}
              </div>

              <MiniBar value={item.stockAvailable} max={maxStock} color={color} />

              {/* Stock numbers */}
              <div className="grid grid-cols-4 gap-1 mt-2">
                <div className="text-center">
                  <p className="text-xs font-bold text-[#F0F2F5]">{item.stockReal}</p>
                  <p className="text-[9px] text-[#6B7280]">Real</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-[#4285F4]">{item.stockReserved}</p>
                  <p className="text-[9px] text-[#6B7280]">Reserv.</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold" style={{ color }}>
                    {item.stockAvailable}
                  </p>
                  <p className="text-[9px] text-[#6B7280]">Disp.</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-[#FF6600]">{item.stockInTransit}</p>
                  <p className="text-[9px] text-[#6B7280]">Transito</p>
                </div>
              </div>

              {/* Assigned orders */}
              {item.assignedOrders.length > 0 && (
                <div className="mt-2 pt-1.5 border-t border-[#1E2330]">
                  <p className="text-[9px] text-[#6B7280] mb-1">Asignado a:</p>
                  <div className="flex flex-wrap gap-1">
                    {item.assignedOrders.map((order, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#1C2230] text-[#9CA3AF] border border-[#2A3040]"
                      >
                        {order.ref} ({order.qty})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
