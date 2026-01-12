import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { SaleOrder, SaleProduct, DailySalesSummary } from '../types/database'

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

      // Intentar usar la tabla de resumen diario primero (más eficiente y sin límite de 1000)
      let useSummary = true
      let summaryData: DailySalesSummary[] = []
      
      try {
        let summaryQuery = supabase
          .from('daily_sales_summary')
          .select('*')
          .order('sale_date', { ascending: false })

        if (fromDate) {
          summaryQuery = summaryQuery.gte('sale_date', fromDate)
        }
        if (toDate) {
          summaryQuery = summaryQuery.lte('sale_date', toDate)
        }

        const { data: summary, error: summaryError } = await summaryQuery

        if (!summaryError && summary && summary.length > 0) {
          summaryData = summary as DailySalesSummary[]
        } else {
          useSummary = false
        }
      } catch (e) {
        useSummary = false
      }

      let filteredOrders: SaleOrder[] = []

      if (useSummary && summaryData.length > 0) {
        // Reconstruir órdenes desde el resumen para compatibilidad con los componentes
        // Esto permite usar los gráficos sin cambios
        filteredOrders = summaryData.flatMap(summary => {
          const orders: SaleOrder[] = []
          // Crear órdenes "sintéticas" basadas en el resumen
          // Distribuir las ventas en órdenes aproximadas
          const ticketsPerDay = summary.total_tickets
          const avgTicket = summary.avg_ticket
          
          // Crear órdenes distribuidas por método de pago
          const cashTickets = Math.round((summary.total_cash / summary.total_sales) * ticketsPerDay) || 0
          const cardTickets = Math.round((summary.total_card / summary.total_sales) * ticketsPerDay) || 0
          const mpTickets = Math.round((summary.total_mercadopago / summary.total_sales) * ticketsPerDay) || 0
          const otherTickets = ticketsPerDay - cashTickets - cardTickets - mpTickets

          // Función helper para generar hora distribuida (8am a 10pm)
          const getDistributedHour = (index: number, total: number): string => {
            // Distribuir uniformemente entre 8am (8) y 10pm (22)
            const hour = 8 + Math.floor((index / total) * 14)
            const minutes = Math.floor((index % 3) * 20) // 0, 20, 40
            return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
          }

          let orderIndex = 0

          // Crear órdenes de efectivo
          for (let i = 0; i < cashTickets; i++) {
            const hour = getDistributedHour(orderIndex, ticketsPerDay)
            orders.push({
              id: parseInt(`${summary.id}${i}1`),
              idSaleOrder: `SUMMARY-${summary.sale_date}-${summary.shop_name}-CASH-${i}`,
              number: 0,
              total: summary.total_cash / cashTickets || avgTicket,
              orderDate: `${summary.sale_date}T${hour}`,
              shopNumber: '',
              shopName: summary.shop_name,
              paymentmethod: 'Efectivo'
            })
            orderIndex++
          }

          // Crear órdenes de tarjeta
          for (let i = 0; i < cardTickets; i++) {
            const hour = getDistributedHour(orderIndex, ticketsPerDay)
            orders.push({
              id: parseInt(`${summary.id}${i}2`),
              idSaleOrder: `SUMMARY-${summary.sale_date}-${summary.shop_name}-CARD-${i}`,
              number: 0,
              total: summary.total_card / cardTickets || avgTicket,
              orderDate: `${summary.sale_date}T${hour}`,
              shopNumber: '',
              shopName: summary.shop_name,
              paymentmethod: 'Tarjeta'
            })
            orderIndex++
          }

          // Crear órdenes de Mercado Pago
          for (let i = 0; i < mpTickets; i++) {
            const hour = getDistributedHour(orderIndex, ticketsPerDay)
            orders.push({
              id: parseInt(`${summary.id}${i}3`),
              idSaleOrder: `SUMMARY-${summary.sale_date}-${summary.shop_name}-MP-${i}`,
              number: 0,
              total: summary.total_mercadopago / mpTickets || avgTicket,
              orderDate: `${summary.sale_date}T${hour}`,
              shopNumber: '',
              shopName: summary.shop_name,
              paymentmethod: 'Mercado Pago'
            })
            orderIndex++
          }

          // Crear órdenes de otros métodos (dividir entre Apps Delivery y Otros)
          // Asumir que 70% de "otros" son apps delivery y 30% son otros métodos
          const appsTickets = Math.round(otherTickets * 0.7)
          const otherMethodsTickets = otherTickets - appsTickets
          
          for (let i = 0; i < appsTickets; i++) {
            const hour = getDistributedHour(orderIndex, ticketsPerDay)
            orders.push({
              id: parseInt(`${summary.id}${i}4`),
              idSaleOrder: `SUMMARY-${summary.sale_date}-${summary.shop_name}-APPS-${i}`,
              number: 0,
              total: (summary.total_other * 0.7) / appsTickets || avgTicket,
              orderDate: `${summary.sale_date}T${hour}`,
              shopNumber: '',
              shopName: summary.shop_name,
              paymentmethod: 'Rappi' // Usar Rappi como representante de apps delivery
            })
            orderIndex++
          }
          
          for (let i = 0; i < otherMethodsTickets; i++) {
            const hour = getDistributedHour(orderIndex, ticketsPerDay)
            orders.push({
              id: parseInt(`${summary.id}${i}5`),
              idSaleOrder: `SUMMARY-${summary.sale_date}-${summary.shop_name}-OTHER-${i}`,
              number: 0,
              total: (summary.total_other * 0.3) / otherMethodsTickets || avgTicket,
              orderDate: `${summary.sale_date}T${hour}`,
              shopNumber: '',
              shopName: summary.shop_name,
              paymentmethod: 'Otro'
            })
            orderIndex++
          }

          return orders
        })

        // Cuando usamos el resumen, obtener productos directamente por rango de fechas
        // en lugar de por IDs de órdenes (que son sintéticos)
        let filteredProducts: SaleProduct[] = []
        
        if (fromDate && toDate) {
          // Obtener todas las órdenes reales del rango para tener sus IDs
          let realOrdersQuery = supabase
            .from('sale_orders')
            .select('idSaleOrder')
            .order('orderDate', { ascending: false })
            .limit(10000) // Límite alto para obtener todos los IDs
          
          if (fromDate) {
            realOrdersQuery = realOrdersQuery.gte('orderDate', `${fromDate}T00:00:00`)
          }
          if (toDate) {
            realOrdersQuery = realOrdersQuery.lte('orderDate', `${toDate}T23:59:59`)
          }
          
          const { data: realOrders, error: realOrdersError } = await realOrdersQuery
          
          if (!realOrdersError && realOrders && realOrders.length > 0) {
            const realOrderIds = realOrders.map((o: any) => o.idSaleOrder)
            
            // Obtener productos en batches
            const batchSize = 500
            for (let i = 0; i < realOrderIds.length; i += batchSize) {
              const batchIds = realOrderIds.slice(i, i + batchSize)
              
              const { data: batchProducts, error: productsError } = await supabase
                .from('sale_products')
                .select('*')
                .in('idSaleOrder', batchIds)
              
              if (!productsError && batchProducts) {
                filteredProducts = filteredProducts.concat((batchProducts || []) as SaleProduct[])
              }
            }
          }
        }
        
        setState({
          orders: filteredOrders,
          products: filteredProducts,
          loading: false,
          error: null,
          isDemo: false
        })
        return
      } else {
        // Fallback: usar sale_orders directamente con paginación
        let allOrders: SaleOrder[] = []
        let offset = 0
        const limit = 1000
        let hasMore = true

        while (hasMore) {
          let ordersQuery = supabase
            .from('sale_orders')
            .select('*')
            .order('orderDate', { ascending: false })
            .range(offset, offset + limit - 1)

          if (fromDate) {
            ordersQuery = ordersQuery.gte('orderDate', `${fromDate}T00:00:00`)
          }
          if (toDate) {
            ordersQuery = ordersQuery.lte('orderDate', `${toDate}T23:59:59`)
          }

          const { data: batch, error: ordersError } = await ordersQuery

          if (ordersError) throw ordersError

          if (batch && batch.length > 0) {
            allOrders = allOrders.concat(batch as SaleOrder[])
            offset += limit
            hasMore = batch.length === limit
          } else {
            hasMore = false
          }
        }

        filteredOrders = allOrders
      }

      // Ahora obtener los productos SOLO de las órdenes reales (no sintéticas)
      // Filtrar solo IDs que no sean sintéticos (no empiezan con "SUMMARY-")
      const realOrderIds = filteredOrders
        .filter(o => !o.idSaleOrder.startsWith('SUMMARY-'))
        .map(o => o.idSaleOrder)
      
      let filteredProducts: SaleProduct[] = []
      
      if (realOrderIds.length > 0) {
        // Dividir en batches de 500 IDs para evitar límites de query
        const batchSize = 500
        for (let i = 0; i < realOrderIds.length; i += batchSize) {
          const batchIds = realOrderIds.slice(i, i + batchSize)
          
          const { data: batchProducts, error: productsError } = await supabase
            .from('sale_products')
            .select('*')
            .in('idSaleOrder', batchIds)
          
          if (productsError) throw productsError
          
          filteredProducts = filteredProducts.concat((batchProducts || []) as SaleProduct[])
        }
      }

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
