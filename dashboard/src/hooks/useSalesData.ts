import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { SaleOrder, SaleProduct } from '../types/database'

// Demo data for when Supabase is not configured
const DEMO_ORDERS: SaleOrder[] = [
  { id: 1, idSaleOrder: 'SO-001', number: 1001, total: 15500, orderDate: '2025-12-24T12:30:00', shopNumber: '66220', shopName: 'Subway Corrientes', paymentmethod: 'Efectivo' },
  { id: 2, idSaleOrder: 'SO-002', number: 1002, total: 23400, orderDate: '2025-12-24T13:15:00', shopNumber: '66220', shopName: 'Subway Corrientes', paymentmethod: 'Mercado Pago' },
  { id: 3, idSaleOrder: 'SO-003', number: 0, total: 18900, orderDate: '2025-12-24T14:00:00', shopNumber: '63953', shopName: 'Subway Lacroze', paymentmethod: 'Efectivo' },
  { id: 4, idSaleOrder: 'SO-004', number: 1004, total: 32100, orderDate: '2025-12-24T11:45:00', shopNumber: '72267', shopName: 'Subway Ortiz', paymentmethod: 'Tarjeta' },
  { id: 5, idSaleOrder: 'SO-005', number: 1005, total: 12300, orderDate: '2025-12-24T15:30:00', shopNumber: '10019', shopName: 'Daniel Ortiz', paymentmethod: 'Efectivo' },
  { id: 6, idSaleOrder: 'SO-006', number: 0, total: 28700, orderDate: '2025-12-24T16:00:00', shopNumber: '30036', shopName: 'Daniel Lacroze', paymentmethod: 'Mercado Pago' },
  { id: 7, idSaleOrder: 'SO-007', number: 1007, total: 45200, orderDate: '2025-12-24T10:00:00', shopNumber: '30038', shopName: 'Daniel Corrientes', paymentmethod: 'Tarjeta' },
]

const DEMO_PRODUCTS: SaleProduct[] = [
  { id: 1, idSaleOrder: 'SO-001', name: 'Sub Italian BMT', quantity: 2, price: 4500, total: 9000, shopName: 'Subway Corrientes' },
  { id: 2, idSaleOrder: 'SO-001', name: 'Cookie', quantity: 3, price: 800, total: 2400, shopName: 'Subway Corrientes' },
  { id: 3, idSaleOrder: 'SO-002', name: 'Sub Pollo Teriyaki', quantity: 1, price: 5200, total: 5200, shopName: 'Subway Corrientes' },
  { id: 4, idSaleOrder: 'SO-003', name: 'Sub Steak & Cheese', quantity: 2, price: 5800, total: 11600, shopName: 'Subway Lacroze' },
  { id: 5, idSaleOrder: 'SO-004', name: 'Sub Atún', quantity: 3, price: 4200, total: 12600, shopName: 'Subway Ortiz' },
  { id: 6, idSaleOrder: 'SO-005', name: 'Medialunas', quantity: 12, price: 350, total: 4200, shopName: 'Daniel Ortiz' },
  { id: 7, idSaleOrder: 'SO-006', name: 'Torta Chocolate', quantity: 2, price: 8500, total: 17000, shopName: 'Daniel Lacroze' },
  { id: 8, idSaleOrder: 'SO-007', name: 'Café con leche', quantity: 8, price: 1200, total: 9600, shopName: 'Daniel Corrientes' },
]

interface SalesDataState {
  orders: SaleOrder[]
  products: SaleProduct[]
  loading: boolean
  error: string | null
  isDemo: boolean
}

// Helper para parsear fechas en diferentes formatos
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null
  
  // Primero intentar como ISO
  let date = new Date(dateStr)
  if (!isNaN(date.getTime())) return date
  
  // Intentar dd/mm/yyyy HH:mm:ss o dd/mm/yyyy
  const dateTimeParts = dateStr.split(' ')
  const datePart = dateTimeParts[0]
  const parts = datePart.split('/')
  if (parts.length === 3) {
    const [day, month, year] = parts
    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    if (!isNaN(date.getTime())) return date
  }
  
  // Intentar yyyy-mm-dd
  const isoParts = datePart.split('-')
  if (isoParts.length === 3 && isoParts[0].length === 4) {
    const [year, month, day] = isoParts
    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    if (!isNaN(date.getTime())) return date
  }
  
  console.log(`⚠️ Could not parse date: ${dateStr}`)
  return null
}

export function useSalesData(fromDate?: string, toDate?: string) {
  const [state, setState] = useState<SalesDataState>({
    orders: [],
    products: [],
    loading: true,
    error: null,
    isDemo: false
  })

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      
      if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
        setState({
          orders: DEMO_ORDERS,
          products: DEMO_PRODUCTS,
          loading: false,
          error: null,
          isDemo: true
        })
        return
      }

      // Fetch ALL orders
      const { data: allOrders, error: ordersError } = await supabase
        .from('sale_orders')
        .select('*')
        .order('orderDate', { ascending: false })

      if (ordersError) throw ordersError

      // Fetch ALL products
      const { data: allProducts, error: productsError } = await supabase
        .from('sale_products')
        .select('*')

      if (productsError) throw productsError

      // Castear los datos
      const ordersData = (allOrders || []) as SaleOrder[]
      const productsData = (allProducts || []) as SaleProduct[]

      console.log(`📊 Datos de Supabase: ${ordersData.length} órdenes, ${productsData.length} productos`)
      if (ordersData.length > 0) {
        console.log(`📅 Primera orden - orderDate: ${ordersData[0].orderDate}`)
      }

      // Filtrar por fecha en el cliente
      let filteredOrders = ordersData
      
      if (fromDate || toDate) {
        // Convertir fechas del filtro (formato yyyy-mm-dd del input date)
        const fromDateObj = fromDate ? new Date(fromDate + 'T00:00:00') : null
        const toDateObj = toDate ? new Date(toDate + 'T23:59:59') : null
        
        console.log(`🔍 Filtro: desde ${fromDate} (${fromDateObj}) hasta ${toDate} (${toDateObj})`)
        
        filteredOrders = filteredOrders.filter(order => {
          const orderDateObj = parseDate(order.orderDate)
          if (!orderDateObj) {
            console.log(`⚠️ No se pudo parsear: ${order.orderDate}`)
            return true // Si no puede parsear, incluir
          }
          
          // Solo comparar fechas (sin hora)
          const orderDateOnly = new Date(orderDateObj.getFullYear(), orderDateObj.getMonth(), orderDateObj.getDate())
          const fromDateOnly = fromDateObj ? new Date(fromDateObj.getFullYear(), fromDateObj.getMonth(), fromDateObj.getDate()) : null
          const toDateOnly = toDateObj ? new Date(toDateObj.getFullYear(), toDateObj.getMonth(), toDateObj.getDate()) : null
          
          if (fromDateOnly && orderDateOnly < fromDateOnly) return false
          if (toDateOnly && orderDateOnly > toDateOnly) return false
          
          return true
        })
        
        console.log(`📋 Después del filtro: ${filteredOrders.length} órdenes`)
      }

      // Obtener IDs de órdenes filtradas para filtrar productos
      const orderIds = new Set(filteredOrders.map(o => o.idSaleOrder))
      
      // Filtrar productos que pertenecen a las órdenes filtradas
      const filteredProducts = productsData.filter(p => 
        orderIds.has(p.idSaleOrder)
      )

      console.log(`Datos cargados: ${filteredOrders.length} órdenes, ${filteredProducts.length} productos`)

      setState({
        orders: filteredOrders,
        products: filteredProducts,
        loading: false,
        error: null,
        isDemo: false
      })
    } catch (err) {
      console.error('Error fetching data:', err)
      setState({
        orders: DEMO_ORDERS,
        products: DEMO_PRODUCTS,
        loading: false,
        error: null,
        isDemo: true
      })
    }
  }, [fromDate, toDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { ...state, refetch: fetchData }
}
