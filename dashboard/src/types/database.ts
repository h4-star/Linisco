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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Shop mapping - Agregá nuevos locales aquí
export const SHOP_MAPPING: Record<string, string> = {
  '66220': 'Subway Corrientes',
  '63953': 'Subway Lacroze',
  '72267': 'Subway Ortiz',
  '10019': 'Daniel Ortiz',
  '30036': 'Daniel Lacroze',
  '30038': 'Daniel Corrientes',
  // Agregá más locales aquí:
  // 'CODIGO': 'Nombre del Local',
}

// Colores por local - Agregá colores para nuevos locales
export const SHOP_COLORS: Record<string, string> = {
  // Subway (tonos verdes)
  'Subway Corrientes': '#00a651',
  'Subway Lacroze': '#00c853',
  'Subway Ortiz': '#69f0ae',
  // Daniel (tonos naranjas)
  'Daniel Ortiz': '#ff6b35',
  'Daniel Lacroze': '#ff8f00',
  'Daniel Corrientes': '#ffab40',
  // Agregá más colores aquí:
  // 'Nombre del Local': '#COLOR_HEX',
}

// Paleta de colores para locales nuevos sin color asignado
const FALLBACK_COLORS = [
  '#8b5cf6', // violeta
  '#ec4899', // rosa
  '#06b6d4', // cyan
  '#84cc16', // lima
  '#f97316', // naranja
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f43f5e', // rojo rosa
]

// Función para obtener color de un local (con fallback automático)
export function getShopColor(shopName: string): string {
  if (SHOP_COLORS[shopName]) {
    return SHOP_COLORS[shopName]
  }
  // Genera un color consistente basado en el nombre
  const hash = shopName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

