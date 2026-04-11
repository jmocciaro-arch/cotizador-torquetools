'use client'

import { WorkflowArrowBar, type WorkflowStep } from '@/components/workflow/workflow-arrow-bar'
import { DocumentHeader } from '@/components/workflow/document-header'
import { CriticalAlertsPanel, type Alert } from '@/components/workflow/critical-alerts-panel'
import { DeliveryProgressCard } from '@/components/workflow/delivery-progress-card'
import { DocumentItemsTree, type DocumentItem, type DocumentItemComponent } from '@/components/workflow/document-items-tree'
import { SupplierPurchasesCard, type SupplierPurchase } from '@/components/workflow/supplier-purchases-card'
import { StockSnapshotCard, type StockSnapshotItem } from '@/components/workflow/stock-snapshot-card'
import { PendingTasksCard, type PendingTask } from '@/components/workflow/pending-tasks-card'
import { InternalNotesCard, type InternalNote } from '@/components/workflow/internal-notes-card'

// =====================================================
// MOCK DATA - Pedido PED-2026-0112 para Grupo Mirgor S.A.
// =====================================================

const mockWorkflowSteps: WorkflowStep[] = [
  {
    key: 'lead',
    label: 'Lead',
    icon: '\uD83C\uDFAF',
    status: 'completed',
    documentRef: 'LEAD-2026-0089',
    date: '15/01/2026',
    tooltip: 'Lead captado via web',
  },
  {
    key: 'coti',
    label: 'Cotizacion',
    icon: '\uD83D\uDCCB',
    status: 'completed',
    documentRef: 'COT-2026-0134',
    date: '22/01/2026',
    tooltip: 'Cotizacion enviada y aceptada',
  },
  {
    key: 'oc_cliente',
    label: 'OC Cliente',
    icon: '\uD83D\uDCC4',
    status: 'completed',
    documentRef: 'OC-MIR-20260045',
    date: '28/01/2026',
    tooltip: 'Orden de compra recibida y validada',
  },
  {
    key: 'pedido',
    label: 'Pedido',
    icon: '\uD83D\uDCE6',
    status: 'current',
    documentRef: 'PED-2026-0112',
    date: '30/01/2026',
    tooltip: 'Pedido en proceso - 42% entregado',
  },
  {
    key: 'pap',
    label: 'Compras',
    icon: '\uD83D\uDED2',
    status: 'partial',
    documentRef: '2 PAPs activos',
    date: '02/02/2026',
    tooltip: 'PAP 23012 atrasado, PAP 23017 en camino',
  },
  {
    key: 'delivery_note',
    label: 'Albaran',
    icon: '\uD83D\uDE9A',
    status: 'partial',
    documentRef: 'ALB-2026-0087',
    date: '10/03/2026',
    tooltip: 'Entrega parcial realizada',
  },
  {
    key: 'factura',
    label: 'Factura',
    icon: '\uD83D\uDCB3',
    status: 'pending',
    tooltip: 'Pendiente de facturacion',
  },
  {
    key: 'cobro',
    label: 'Cobro',
    icon: '\uD83D\uDCB0',
    status: 'pending',
    tooltip: 'Pendiente de cobro',
  },
]

const mockDocument = {
  id: 'ped-2026-0112-uuid',
  type: 'pedido',
  system_code: 'PED-2026-0112',
  display_ref: 'Pedido Mirgor - Llaves torque',
  status: 'partial',
  currency: 'EUR',
  subtotal: 28450.00,
  tax_amount: 5974.50,
  total: 34424.50,
  delivery_date: '2026-03-15',
  incoterm: 'DAP',
  payment_terms: '60 dias fecha factura',
  created_at: '2026-01-30T10:00:00Z',
}

const mockClient = {
  id: 'mirgor-uuid',
  name: 'Grupo Mirgor S.A.',
  tax_id: '30-50437103-8',
  country: 'AR',
}

const mockCompany = {
  id: 'tt-es-uuid',
  name: 'TorqueTools SL',
  country: 'ES',
}

const mockParentDocs = [
  { type: 'coti', ref: 'COT-2026-0134', id: 'cot-uuid' },
  { type: 'oc_cliente', ref: 'OC-MIR-20260045', id: 'oc-uuid' },
]

const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    type: 'po_overdue',
    severity: 'critical',
    title: 'PAP 23012 atrasado 12 dias',
    description: 'Embaliq SAC no confirmo envio. Llaves torque Tohnichi CL100N pendientes.',
    documentRef: 'PAP-23012',
    dueDate: '28/02/2026',
    status: 'active',
  },
  {
    id: 'alert-2',
    type: 'oc_unmapped',
    severity: 'warning',
    title: 'Item OC sin mapear',
    description: 'Linea 5 de OC Mirgor: "Kit mantenimiento" no tiene producto asociado.',
    documentRef: 'OC-MIR-20260045',
    status: 'active',
  },
  {
    id: 'alert-3',
    type: 'pending_delivery',
    severity: 'urgent',
    title: 'Entrega parcial vencida',
    description: 'Fecha compromiso 15/03 ya paso. Quedan 3 items sin entregar.',
    dueDate: '15/03/2026',
    status: 'active',
  },
]

const mockItems: DocumentItem[] = [
  {
    id: 'item-1',
    sku: 'TOH-CL100N',
    description: 'Llave torque Tohnichi CL100N',
    quantity: 10,
    unit_price: 4500.00,
    subtotal: 45000.00,
    qty_delivered: 4,
    qty_invoiced: 0,
    qty_reserved: 6,
    status: 'partial',
    statusColor: '#FFB300',
    statusLabel: 'Entrega parcial',
    stockAvailable: 6,
    stockReserved: 6,
    stockIndicator: 'low',
    requires_po: true,
    po_status: 'overdue',
    hasComponents: false,
    notes: 'Quedan 6 unidades por entregar',
  },
  {
    id: 'item-2',
    sku: 'KIT-FERR-01',
    description: 'Kit Ferreteria Industrial',
    quantity: 50,
    unit_price: 185.00,
    subtotal: 9250.00,
    qty_delivered: 50,
    qty_invoiced: 0,
    qty_reserved: 0,
    status: 'completed',
    statusColor: '#00C853',
    statusLabel: 'Entregado',
    stockAvailable: 120,
    stockReserved: 0,
    stockIndicator: 'ok',
    requires_po: false,
    hasComponents: true,
  },
  {
    id: 'item-3',
    sku: 'FEIN-AMM500',
    description: 'FEIN MultiMaster AMM 500 Plus',
    quantity: 5,
    unit_price: 1890.00,
    subtotal: 9450.00,
    qty_delivered: 0,
    qty_invoiced: 0,
    qty_reserved: 3,
    status: 'blocked',
    statusColor: '#FF3D00',
    statusLabel: 'Sin stock',
    stockAvailable: 3,
    stockReserved: 3,
    stockIndicator: 'critical',
    requires_po: true,
    po_status: 'sent',
    hasComponents: false,
  },
  {
    id: 'item-4',
    sku: 'IR-2235-TI',
    description: 'Ingersoll Rand 2235TiMAX Impacto 1/2"',
    quantity: 8,
    unit_price: 2150.00,
    subtotal: 17200.00,
    qty_delivered: 8,
    qty_invoiced: 0,
    qty_reserved: 0,
    status: 'completed',
    statusColor: '#00C853',
    statusLabel: 'Entregado',
    stockAvailable: 15,
    stockReserved: 0,
    stockIndicator: 'ok',
    requires_po: false,
    hasComponents: false,
  },
  {
    id: 'item-5',
    sku: 'KIT-MANT-MIR',
    description: 'Kit mantenimiento (ver OC linea 5)',
    quantity: 1,
    unit_price: 0,
    subtotal: 0,
    qty_delivered: 0,
    qty_invoiced: 0,
    qty_reserved: 0,
    status: 'blocked',
    statusColor: '#FF3D00',
    statusLabel: 'Sin mapear',
    stockAvailable: 0,
    stockReserved: 0,
    stockIndicator: 'critical',
    requires_po: false,
    hasComponents: true,
  },
]

const mockComponents: DocumentItemComponent[] = [
  {
    id: 'comp-1',
    parent_item_id: 'item-2',
    sku: 'TORN-A-7110',
    description: 'Tornillo hexagonal A 7110',
    quantity: 7110,
    unit_cost: 0.008,
    status: 'completed',
    statusLabel: 'En stock',
    statusColor: '#00C853',
    stockAvailable: 15000,
    stockIndicator: 'ok',
  },
  {
    id: 'comp-2',
    parent_item_id: 'item-2',
    sku: 'ARAND-B-615',
    description: 'Arandela plana B 6/15',
    quantity: 3050,
    unit_cost: 0.004,
    status: 'partial',
    statusLabel: 'Llegan en 2 dias',
    statusColor: '#4285F4',
    stockAvailable: 2800,
    stockIndicator: 'low',
  },
  {
    id: 'comp-3',
    parent_item_id: 'item-2',
    sku: 'TUER-C-M8',
    description: 'Tuerca hexagonal C M8',
    quantity: 5000,
    unit_cost: 0.006,
    status: 'completed',
    statusLabel: 'En stock',
    statusColor: '#00C853',
    stockAvailable: 8200,
    stockIndicator: 'ok',
  },
  {
    id: 'comp-4',
    parent_item_id: 'item-5',
    sku: 'SIN-MAPEAR',
    description: 'Producto sin asociar - verificar con cliente',
    quantity: 1,
    unit_cost: 0,
    status: 'blocked',
    statusLabel: 'Sin mapear',
    statusColor: '#FF3D00',
    stockAvailable: 0,
    stockIndicator: 'critical',
  },
]

const mockPurchases: SupplierPurchase[] = [
  {
    id: 'pap-1',
    ref: 'PAP-23012',
    supplier: 'Embaliq SAC',
    status: 'overdue',
    statusColor: '#FF3D00',
    expectedArrival: '28/02/2026',
    isOverdue: true,
    daysOverdue: 12,
    total: 12800.00,
    currency: 'EUR',
    itemCount: 3,
  },
  {
    id: 'pap-2',
    ref: 'PAP-23017',
    supplier: 'Siprol SRL',
    status: 'confirmed',
    statusColor: '#00C853',
    expectedArrival: '18/03/2026',
    isOverdue: false,
    total: 5400.00,
    currency: 'EUR',
    itemCount: 2,
  },
]

const mockStockItems: StockSnapshotItem[] = [
  {
    productId: 'p-1',
    productName: 'Tohnichi CL100N',
    sku: 'TOH-CL100N',
    stockReal: 12,
    stockReserved: 6,
    stockAvailable: 6,
    stockInTransit: 4,
    assignedOrders: [
      { ref: 'PED-0112', qty: 6 },
      { ref: 'PED-0118', qty: 2 },
    ],
    indicator: 'low',
  },
  {
    productId: 'p-2',
    productName: 'FEIN AMM 500 Plus',
    sku: 'FEIN-AMM500',
    stockReal: 3,
    stockReserved: 3,
    stockAvailable: 0,
    stockInTransit: 5,
    assignedOrders: [
      { ref: 'PED-0112', qty: 3 },
    ],
    indicator: 'critical',
  },
  {
    productId: 'p-3',
    productName: 'IR 2235TiMAX',
    sku: 'IR-2235-TI',
    stockReal: 15,
    stockReserved: 0,
    stockAvailable: 15,
    stockInTransit: 0,
    assignedOrders: [],
    indicator: 'ok',
  },
]

const mockTasks: PendingTask[] = [
  {
    id: 'task-1',
    title: 'Reclamar envio PAP-23012 a Embaliq',
    type: 'purchase',
    priority: 'urgent',
    dueDate: 'Hoy',
    assignedTo: 'Juan',
    completed: false,
    documentRef: 'PAP-23012',
  },
  {
    id: 'task-2',
    title: 'Preparar albaran entrega parcial #2',
    type: 'delivery',
    priority: 'high',
    dueDate: '15/04/2026',
    completed: false,
    documentRef: 'PED-0112',
  },
  {
    id: 'task-3',
    title: 'Mapear item OC linea 5 con producto',
    type: 'custom',
    priority: 'normal',
    completed: false,
    documentRef: 'OC-MIR-20260045',
  },
  {
    id: 'task-4',
    title: 'Facturar entrega parcial #1 (IR 2235)',
    type: 'invoice',
    priority: 'normal',
    dueDate: '20/04/2026',
    completed: false,
    documentRef: 'ALB-2026-0087',
  },
  {
    id: 'task-5',
    title: 'Confirmar stock FEIN AMM500 con proveedor',
    type: 'stock',
    priority: 'high',
    completed: false,
  },
  {
    id: 'task-6',
    title: 'Primer contacto con lead Mirgor',
    type: 'custom',
    priority: 'low',
    completed: true,
    documentRef: 'LEAD-0089',
  },
]

const mockNotes: InternalNote[] = [
  {
    id: 'note-1',
    author: 'Juan M.',
    authorInitials: 'JM',
    content: 'Mirgor pidio adelantar las llaves torque Tohnichi. Priorizar envio apenas llegue la mercaderia de Embaliq.',
    createdAt: '10/03/2026 14:30',
  },
  {
    id: 'note-2',
    author: 'Sistema',
    authorInitials: 'S',
    content: 'Entrega parcial ALB-2026-0087 generada automaticamente. Items: IR 2235TiMAX (8u) + Kit Ferreteria (50u).',
    createdAt: '10/03/2026 09:00',
    isSystem: true,
  },
  {
    id: 'note-3',
    author: 'Juan M.',
    authorInitials: 'JM',
    content: 'Linea 5 de la OC dice "Kit mantenimiento" pero no especifica productos. Escribi a Gonzalez de Mirgor para aclarar.',
    createdAt: '02/02/2026 16:45',
  },
]

// =====================================================
// PAGE COMPONENT
// =====================================================

export default function DocumentDetailPage() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-4">
      {/* Workflow Arrow Bar - Full Width */}
      <WorkflowArrowBar
        steps={mockWorkflowSteps}
        onStepClick={(step) => console.log('Step clicked:', step.key)}
      />

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_280px] gap-4">
        {/* LEFT PANEL */}
        <div className="space-y-4 order-2 lg:order-1">
          <CriticalAlertsPanel
            alerts={mockAlerts}
            onAlertClick={(alert) => console.log('Alert clicked:', alert.id)}
            onDismiss={(id) => console.log('Dismiss:', id)}
          />

          <DeliveryProgressCard
            clientName="Grupo Mirgor S.A."
            deliveredPct={42}
            invoicedPct={0}
            collectedPct={0}
            ocRef="OC-MIR-20260045"
            itemStatuses={[
              { label: 'Entregado', color: '#00C853' },
              { label: 'Parcial', color: '#FFB300' },
              { label: 'Bloqueado', color: '#FF3D00' },
              { label: 'Sin mapear', color: '#FF3D00' },
            ]}
          />

          <SupplierPurchasesCard
            purchases={mockPurchases}
            onPurchaseClick={(p) => console.log('Purchase clicked:', p.ref)}
          />
        </div>

        {/* CENTER PANEL */}
        <div className="space-y-4 order-1 lg:order-2">
          <DocumentHeader
            document={mockDocument}
            client={mockClient}
            company={mockCompany}
            assignedTo="Juan Manuel"
            parentDocs={mockParentDocs}
            onRefChange={(ref) => console.log('Ref changed:', ref)}
          />

          <DocumentItemsTree
            items={mockItems}
            components={mockComponents}
            showStock={true}
            onItemAction={(id, action) => console.log('Item action:', id, action)}
          />

          <InternalNotesCard
            notes={mockNotes}
            onAddNote={(content) => console.log('New note:', content)}
          />
        </div>

        {/* RIGHT PANEL */}
        <div className="space-y-4 order-3">
          {/* Internal tracking summary */}
          <div className="bg-[#141820] rounded-xl border border-[#2A3040] p-4">
            <h3 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wide mb-3">
              Seguimiento interno
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6B7280]">Margen estimado</span>
                <span className="text-xs font-bold text-[#00C853]">32.4%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6B7280]">Dias en proceso</span>
                <span className="text-xs font-bold text-[#FFB300]">72</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6B7280]">Entregas realizadas</span>
                <span className="text-xs font-bold text-[#F0F2F5]">1 de 3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6B7280]">Facturas emitidas</span>
                <span className="text-xs font-bold text-[#6B7280]">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6B7280]">Cobros recibidos</span>
                <span className="text-xs font-bold text-[#6B7280]">0</span>
              </div>

              {/* Progress bar for overall */}
              <div className="pt-2 mt-2 border-t border-[#1E2330]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#6B7280]">Avance general</span>
                  <span className="text-xs font-bold text-[#FFB300]">42%</span>
                </div>
                <div className="w-full h-2 bg-[#1E2330] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#FF6600] to-[#FFB300] transition-all"
                    style={{ width: '42%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <StockSnapshotCard
            items={mockStockItems}
            warehouseName="Deposito Madrid"
          />

          <PendingTasksCard
            tasks={mockTasks}
            onToggle={(id) => console.log('Toggle task:', id)}
            onTaskClick={(task) => console.log('Task clicked:', task.id)}
          />
        </div>
      </div>
    </div>
  )
}
