export interface SaleOrder {
  id: number
  idSaleOrder: string
  number: number
  total: number
  orderDate: string
  shopNumber: string
  shopName: string
  paymentmethod: string
  created_at?: string
}

export interface SaleProduct {
  id: number
  idSaleOrder: string
  name: string
  quantity: number
  price: number
  total: number
  shopName: string
  created_at?: string
}

export interface PSession {
  id: number
  shopName: string
  date: string
  openingCash: number
  closingCash: number
  totalSales: number
  created_at?: string
}

export interface DailySalesSummary {
  id: number
  sale_date: string
  shop_name: string
  total_sales: number
  total_tickets: number
  total_cash: number
  total_card: number
  total_mercadopago: number
  total_other: number
  avg_ticket: number
  created_at?: string
  updated_at?: string
}

export type UserRole = 'admin' | 'manager' | 'employee'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  role: UserRole
  assigned_shops: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MessageCategory = 'general' | 'urgente' | 'sugerencia' | 'reclamo' | 'consulta'
export type MessageStatus = 'pending' | 'read' | 'replied' | 'archived'

export interface EmployeeMessage {
  id: number
  user_id: string
  subject: string
  message: string
  category: MessageCategory
  status: MessageStatus
  admin_reply: string | null
  replied_at: string | null
  replied_by: string | null
  created_at: string
  updated_at: string
  user?: UserProfile
}

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'full'
export type ClosingStatus = 'pending' | 'approved' | 'review' | 'rejected'

export interface CashClosing {
  id: number
  user_id: string
  shop_name: string
  closing_date: string
  shift: ShiftType
  // Métodos de pago
  cash_sales: number           // Efectivo
  card_sales: number           // Tarjetas
  mercadopago_sales: number    // Mercado Pago QR
  rappi_sales: number          // Rappi
  pedidosya_sales: number      // Pedidos Ya
  mp_delivery_sales: number    // Mercado Pago Delivery
  other_sales: number          // Otros
  total_declared: number
  // Caja física
  opening_cash: number
  closing_cash: number
  cash_difference: number
  // Comparación API
  api_total: number | null
  api_cash: number | null
  api_card: number | null
  variance: number | null
  variance_percentage: number | null
  // Estado
  status: ClosingStatus
  notes: string | null
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  user?: UserProfile
}

export type TicketType = 'repair' | 'vacation' | 'day_off' | 'supply' | 'other'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'approved' | 'rejected' | 'completed' | 'cancelled'

export interface Ticket {
  id: number
  user_id: string
  shop_name: string | null
  ticket_type: TicketType
  title: string
  description: string
  priority: TicketPriority
  date_from: string | null
  date_to: string | null
  status: TicketStatus
  assigned_to: string | null
  resolution: string | null
  resolved_by: string | null
  resolved_at: string | null
  attachments: string[]
  created_at: string
  updated_at: string
  user?: UserProfile
  comments?: TicketComment[]
}

export interface TicketComment {
  id: number
  ticket_id: number
  user_id: string
  comment: string
  created_at: string
  user?: UserProfile
}

export interface Database {
  public: {
    Tables: {
      sale_orders: {
        Row: SaleOrder
        Insert: Omit<SaleOrder, 'id' | 'created_at'>
        Update: Partial<Omit<SaleOrder, 'id'>>
      }
      sale_products: {
        Row: SaleProduct
        Insert: Omit<SaleProduct, 'id' | 'created_at'>
        Update: Partial<Omit<SaleProduct, 'id'>>
      }
      psessions: {
        Row: PSession
        Insert: Omit<PSession, 'id' | 'created_at'>
        Update: Partial<Omit<PSession, 'id'>>
      }
      user_profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserProfile, 'id' | 'created_at'>>
      }
      employee_messages: {
        Row: EmployeeMessage
        Insert: Omit<EmployeeMessage, 'id' | 'created_at' | 'updated_at' | 'user'>
        Update: Partial<Omit<EmployeeMessage, 'id' | 'created_at' | 'user'>>
      }
      cash_closings: {
        Row: CashClosing
        Insert: Omit<CashClosing, 'id' | 'created_at' | 'updated_at' | 'user'>
        Update: Partial<Omit<CashClosing, 'id' | 'created_at' | 'user'>>
      }
      tickets: {
        Row: Ticket
        Insert: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'user' | 'comments'>
        Update: Partial<Omit<Ticket, 'id' | 'created_at' | 'user' | 'comments'>>
      }
      ticket_comments: {
        Row: TicketComment
        Insert: Omit<TicketComment, 'id' | 'created_at' | 'user'>
        Update: Partial<Omit<TicketComment, 'id' | 'created_at' | 'user'>>
      }
      purchase_invoices: {
        Row: PurchaseInvoice
        Insert: Omit<PurchaseInvoice, 'id' | 'created_at' | 'updated_at' | 'total' | 'user'>
        Update: Partial<Omit<PurchaseInvoice, 'id' | 'created_at' | 'user'>>
      }
      inventory_products: {
        Row: InventoryProduct
        Insert: Omit<InventoryProduct, 'id' | 'created_at' | 'updated_at' | 'user'>
        Update: Partial<Omit<InventoryProduct, 'id' | 'created_at' | 'user'>>
      }
      inventory_purchases: {
        Row: InventoryPurchase
        Insert: Omit<InventoryPurchase, 'id' | 'created_at' | 'updated_at' | 'user' | 'product'>
        Update: Partial<Omit<InventoryPurchase, 'id' | 'created_at' | 'user' | 'product'>>
      }
      product_prices: {
        Row: ProductPrice
        Insert: Omit<ProductPrice, 'id' | 'created_at' | 'updated_at' | 'user' | 'product'>
        Update: Partial<Omit<ProductPrice, 'id' | 'created_at' | 'user' | 'product'>>
      }
      inventory_stock_snapshots: {
        Row: InventoryStockSnapshot
        Insert: Omit<InventoryStockSnapshot, 'id' | 'created_at' | 'updated_at' | 'user' | 'product'>
        Update: Partial<Omit<InventoryStockSnapshot, 'id' | 'created_at' | 'user' | 'product'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export const SHOP_MAPPING: Record<string, string> = {
  '66220': 'Subway Corrientes',
  '63953': 'Subway Lacroze',
  '72267': 'Subway Ortiz',
  '10019': 'Daniel Ortiz',
  '30036': 'Daniel Lacroze',
  '30038': 'Daniel Corrientes',
  '10020': 'Seitu Juramento',
  '75248': 'Subway Juramento',
}

export const SHOP_LIST = [
  'Subway Corrientes',
  'Subway Lacroze',
  'Subway Ortiz',
  'Subway Juramento',
  'Daniel Ortiz',
  'Daniel Lacroze',
  'Daniel Corrientes',
  'Seitu Juramento',
]

export const SHOP_COLORS: Record<string, string> = {
  'Subway Corrientes': '#00a651',
  'Subway Lacroze': '#00c853',
  'Subway Ortiz': '#69f0ae',
  'Subway Juramento': '#00e676',
  'Daniel Ortiz': '#ff6b35',
  'Daniel Lacroze': '#ff8f00',
  'Daniel Corrientes': '#ffab40',
  'Seitu Juramento': '#8b5cf6',
}

const FALLBACK_COLORS = [
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#f43f5e',
]

export function getShopColor(shopName: string): string {
  if (SHOP_COLORS[shopName]) {
    return SHOP_COLORS[shopName]
  }
  const hash = shopName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  repair: 'Arreglo/Mantenimiento',
  vacation: 'Vacaciones',
  day_off: 'Franco/Dia especial',
  supply: 'Pedido de insumos',
  other: 'Otro',
}

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export const MESSAGE_CATEGORY_LABELS: Record<MessageCategory, string> = {
  general: 'General',
  urgente: 'Urgente',
  sugerencia: 'Sugerencia',
  reclamo: 'Reclamo',
  consulta: 'Consulta',
}

export const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: 'Manana',
  afternoon: 'Tarde',
  night: 'Noche',
  full: 'Dia completo',
}

export const CLOSING_STATUS_LABELS: Record<ClosingStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  review: 'En revision',
  rejected: 'Rechazado',
}

export interface PurchaseInvoice {
  id: number
  user_id: string
  invoice_number: string
  invoice_date: string
  supplier_name: string | null
  supplier_cuit: string | null
  subtotal: number
  iva: number | null
  internal_taxes: number | null
  total: number
  shop_name: string | null
  notes: string | null
  attachment_url: string | null
  created_at: string
  updated_at: string
  user?: UserProfile
}

export type UnitOfMeasure = 'kg' | 'litros' | 'unidades' | 'cajas' | 'paquetes' | 'bolsas' | 'otro'

export interface InventoryProduct {
  id: number
  user_id: string
  name: string
  unit_of_measure: string
  category: string | null
  description: string | null
  shop_name: string
  is_active: boolean
  created_at: string
  updated_at: string
  user?: UserProfile
}

export interface InventoryPurchase {
  id: number
  user_id: string
  product_id: number
  purchase_date: string
  quantity: number
  unit_of_measure: string
  unit_price: number | null
  total_amount: number | null
  shop_name: string
  supplier_name: string | null
  invoice_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
  user?: UserProfile
  product?: InventoryProduct
}

export interface ProductPrice {
  id: number
  product_id: number
  user_id: string
  price: number
  effective_date: string
  is_current: boolean
  created_at: string
  updated_at: string
  user?: UserProfile
  product?: InventoryProduct
}

export interface InventoryStockSnapshot {
  id: number
  user_id: string
  product_id: number
  snapshot_date: string
  quantity: number
  unit_of_measure: string
  shop_name: string
  notes: string | null
  is_initial_stock: boolean
  created_at: string
  updated_at: string
  user?: UserProfile
  product?: InventoryProduct
}

export const UNIT_OF_MEASURE_LABELS: Record<UnitOfMeasure, string> = {
  kg: 'Kilogramos (kg)',
  litros: 'Litros (L)',
  unidades: 'Unidades',
  cajas: 'Cajas',
  paquetes: 'Paquetes',
  bolsas: 'Bolsas',
  otro: 'Otro'
}