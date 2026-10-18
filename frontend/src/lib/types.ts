export interface User {
  id: number
  email: string
  name: string
  role: 'admin' | 'cashier'
  owner_id: number | null
  is_active: boolean
  created_at: string
}

export interface TokenOut {
  access_token: string
  token_type: string
  user: User
}

export interface Product {
  id: number
  sku: string
  barcode: string | null
  name: string
  category: string
  image_url: string | null
  price_cents: number
  cost_cents: number
  stock: number
  min_stock: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: number
  product_id: number
  qty_delta: number
  reason: string
  note: string | null
  user_id: number | null
  created_at: string
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
}

export interface CustomerBrief {
  id: number
  name: string
}

export interface SaleItem {
  id: number
  product_id: number
  product_name: string
  qty: number
  unit_price_cents: number
  line_total_cents: number
}

export interface Sale {
  id: number
  status: 'completed' | 'voided'
  created_at: string
  voided_at: string | null
  cashier_name: string | null
  customer: CustomerBrief | null
  payment_method: 'cash' | 'transfer' | 'card'
  cash_received_cents: number | null
  change_cents: number | null
  subtotal_cents: number
  discount_cents: number
  tax_cents: number
  total_cents: number
  items: SaleItem[]
}

export interface SaleList {
  total: number
  items: Sale[]
}

export interface DashboardSummary {
  sales_today_cents: number
  sales_today_count: number
  sales_month_cents: number
  sales_month_count: number
  products_count: number
  low_stock_count: number
  customers_count: number
}

export interface SeriesPoint {
  date: string
  total_cents: number
  count: number
}

export interface SalesSeries {
  days: number
  points: SeriesPoint[]
}

export interface TopProduct {
  product_id: number
  name: string
  qty: number
  total_cents: number
}

export interface TopProducts {
  items: TopProduct[]
}

export interface LowStockItem {
  product_id: number
  name: string
  stock: number
  min_stock: number
}

export interface CashSession {
  id: number
  status: 'open' | 'closed'
  opened_by_name: string
  opened_at: string
  opening_cents: number
  closed_by_name: string | null
  closed_at: string | null
  expected_cents: number | null
  counted_cents: number | null
  difference_cents: number | null
  note: string | null
}

export interface CashStatus {
  is_open: boolean
  session: CashSession | null
  cash_sales_cents: number
  cash_sales_count: number
  expected_cents: number
}

export type OrderStatus = 'pending' | 'confirmed' | 'rejected'
export type OrderChannel = 'whatsapp' | 'web' | 'mostrador'

export interface OrderItem {
  id: number
  product_id: number
  product_name: string
  qty: number
  unit_price_cents: number
  line_total_cents: number
}

export interface Order {
  id: number
  status: OrderStatus
  channel: OrderChannel
  customer_name: string
  customer_phone: string | null
  note: string | null
  created_at: string
  confirmed_at: string | null
  rejected_at: string | null
  rejected_reason: string | null
  sale_id: number | null
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  items: OrderItem[]
}

export interface OrderList {
  total: number
  items: Order[]
}
