// =====================================================
// TorqueTools ERP - TypeScript Types
// =====================================================

export interface Company {
  id: string
  name: string
  legal_name: string | null
  tax_id: string | null
  country: string
  currency: 'EUR' | 'ARS' | 'USD'
  address: string | null
  city: string | null
  postal_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  iban: string | null
  swift: string | null
  default_tax_rate: number
  default_margin: number
  invoice_prefix: string | null
  invoice_next_number: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  auth_id: string | null
  email: string
  full_name: string
  short_name: string | null
  role: 'admin' | 'vendedor' | 'viewer'
  phone: string | null
  whatsapp: string | null
  avatar_url: string | null
  default_company_id: string | null
  permissions: Record<string, boolean>
  gmail_connected: boolean
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface ProductCategory {
  id: string
  name: string
  slug: string
  parent_id: string | null
  description: string | null
  sort_order: number
  created_at: string
}

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  brand: string
  category_id: string | null
  category_name: string | null
  price_cost: number
  price_list: number
  price_currency: string
  weight_kg: number | null
  hs_code: string | null
  origin_country: string | null
  image_url: string | null
  specs: Record<string, string>
  is_active: boolean
  is_featured: boolean
  search_tokens: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  code: string | null
  company_name: string
  legal_name: string | null
  tax_id: string | null
  type: 'empresa' | 'autonomo' | 'particular' | 'distribuidor'
  country: string
  address: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  payment_terms: string
  credit_limit: number
  discount_default: number
  currency: string
  assigned_to: string | null
  tags: string[]
  notes: string | null
  is_active: boolean
  total_revenue: number
  last_order_date: string | null
  created_at: string
  updated_at: string
}

export interface ClientContact {
  id: string
  client_id: string
  full_name: string
  position: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
}

export interface Warehouse {
  id: string
  name: string
  code: string
  address: string | null
  city: string | null
  country: string
  company_id: string | null
  is_active: boolean
  created_at: string
}

export interface Stock {
  id: string
  product_id: string
  warehouse_id: string
  quantity: number
  reserved: number
  min_stock: number
  max_stock: number
  last_counted_at: string | null
  updated_at: string
  // Joined
  product?: Product
  warehouse?: Warehouse
}

export type QuoteStatus = 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'expirada' | 'facturada'

export interface Quote {
  id: string
  quote_number: string
  company_id: string
  client_id: string | null
  client_contact_id: string | null
  created_by: string
  status: QuoteStatus
  title: string | null
  notes: string | null
  internal_notes: string | null
  incoterm: string | null
  payment_terms: string | null
  validity_days: number
  currency: string
  exchange_rate: number
  subtotal: number
  discount_total: number
  tax_rate: number
  tax_amount: number
  total: number
  sent_at: string | null
  accepted_at: string | null
  expires_at: string | null
  tags: string[]
  created_at: string
  updated_at: string
  // Joined
  company?: Company
  client?: Client
  items?: QuoteItem[]
  creator?: User
}

export interface QuoteItem {
  id: string
  quote_id: string
  product_id: string | null
  sort_order: number
  sku: string | null
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  subtotal: number
  notes: string | null
  created_at: string
  // Joined
  product?: Product
}

export type CRMStage = 'lead' | 'propuesta' | 'negociacion' | 'ganado' | 'perdido'

export interface Opportunity {
  id: string
  title: string
  client_id: string | null
  company_id: string | null
  assigned_to: string | null
  stage: CRMStage
  value: number
  currency: string
  probability: number
  expected_close_date: string | null
  source: string | null
  lost_reason: string | null
  notes: string | null
  tags: string[]
  quote_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
  // Joined
  client?: Client
  assignee?: User
}

export interface PurchaseOrder {
  id: string
  po_number: string
  company_id: string
  supplier_name: string
  supplier_contact: string | null
  supplier_email: string | null
  status: string
  currency: string
  subtotal: number
  tax_amount: number
  total: number
  notes: string | null
  expected_delivery: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface POItem {
  id: string
  po_id: string
  product_id: string | null
  sku: string | null
  description: string
  quantity: number
  received_quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

export interface SalesOrder {
  id: string
  so_number: string
  company_id: string
  client_id: string | null
  quote_id: string | null
  status: string
  currency: string
  subtotal: number
  tax_amount: number
  total: number
  shipping_address: string | null
  tracking_number: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SATTicket {
  id: string
  ticket_number: string
  client_id: string | null
  company_id: string | null
  assigned_to: string | null
  product_id: string | null
  serial_number: string | null
  type: 'reparacion' | 'mantenimiento' | 'garantia' | 'instalacion' | 'calibracion'
  priority: 'baja' | 'normal' | 'alta' | 'urgente'
  status: 'abierto' | 'en_proceso' | 'esperando_repuesto' | 'resuelto' | 'cerrado'
  title: string
  description: string | null
  resolution: string | null
  estimated_hours: number | null
  actual_hours: number | null
  cost: number
  created_at: string
  updated_at: string
  resolved_at: string | null
  // Joined
  client?: Client
  assignee?: User
  product?: Product
}

export interface ActivityLog {
  id: string
  user_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
  // Joined
  user?: User
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string | null
  type: 'info' | 'success' | 'warning' | 'error'
  link: string | null
  is_read: boolean
  created_at: string
}

export interface MailFollowup {
  id: string
  user_id: string
  client_id: string | null
  subject: string
  gmail_thread_id: string | null
  gmail_message_id: string | null
  status: 'pendiente' | 'seguimiento' | 'respondido' | 'archivado'
  follow_up_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SystemParam {
  id: string
  key: string
  value: string | null
  description: string | null
  updated_at: string
}

// =====================================================
// UI / Helper Types
// =====================================================

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: number
  children?: NavItem[]
}

export interface KPIData {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: string
  color?: string
}

export interface SelectOption {
  value: string
  label: string
}

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
  className?: string
}
