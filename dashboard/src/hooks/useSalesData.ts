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
  { id: 8, idSaleOrder: 'SO-008', number: 1008, total: 19800, orderDate: '2025-12-24T17:30:00', shopNumber: '66220', shopName: 'Subway Corrientes', paymentmethod: 'Efectivo' },
  { id: 9, idSaleOrder: 'SO-009', number: 0, total: 21500, orderDate: '2025-12-24T18:15:00', shopNumber: '63953', shopName: 'Subway Lacroze', paymentmethod: 'Tarjeta' },
  { id: 10, idSaleOrder: 'SO-010', number: 1010, total: 16700, orderDate: '2025-12-24T19:00:00', shopNumber: '10019', shopName: 'Daniel Ortiz', paymentmethod: 'Mercado Pago' },
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
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      console.log('Supabase URL:', supabaseUrl)
      
      if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
        console.log('Using demo data - Supabase not configured')
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
      console.log('Fetching orders from Supabase...')
      const { data: orders, error: ordersError } = await supabase
        .from('sale_orders')
        .select('*')
        .order('orderDate', { ascending: false })

      console.log('Orders result:', { count: orders?.length, error: ordersError })

      if (ordersError) {
        console.error('Orders error:', ordersError)
        throw ordersError
      }

      // Fetch products (sin límite para obtener todos)
      console.log('Fetching products from Supabase...')
      const { data: products, error: productsError } = await supabase
        .from('sale_products')
        .select('*')

      console.log('Products result:', { count: products?.length, error: productsError })

      if (productsError) {
        console.error('Products error:', productsError)
        throw productsError
      }

      console.log('Data loaded successfully:', { orders: orders?.length, products: products?.length })

      setState({
        orders: orders || [],
        products: products || [],
        loading: false,
        error: null,
        isDemo: false
      })
    } catch (err) {
      console.error('Error fetching data:', err)
      // Fallback to demo data on error
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

