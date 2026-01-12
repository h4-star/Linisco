import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Clock } from 'lucide-react'
import type { SaleOrder } from '../types/database'
import { getShopColor } from '../types/database'
import { supabase } from '../lib/supabase'

interface SalesByHourChartProps {
  orders: SaleOrder[]
  fromDate?: string
  toDate?: string
}

export function SalesByHourChart({ orders, fromDate, toDate }: SalesByHourChartProps) {
  const [realOrdersForHours, setRealOrdersForHours] = useState<SaleOrder[]>([])
  const [loadingHours, setLoadingHours] = useState(false)
  // Detectar si estamos usando órdenes sintéticas (del resumen)
  const hasSyntheticOrders = orders.some(o => o.idSaleOrder?.startsWith('SUMMARY-'))
  
  // Si hay órdenes sintéticas, obtener una muestra de órdenes reales para calcular horas correctamente
  useEffect(() => {
    if (hasSyntheticOrders && fromDate && toDate) {
      setLoadingHours(true)
      
      const fetchRealOrders = async () => {
        try {
          let ordersQuery = supabase
            .from('sale_orders')
            .select('idSaleOrder, orderDate, shopName')
            .order('orderDate', { ascending: false })
            .limit(2000)
          
          if (fromDate) {
            ordersQuery = ordersQuery.gte('orderDate', `${fromDate}T00:00:00`)
          }
          if (toDate) {
            ordersQuery = ordersQuery.lte('orderDate', `${toDate}T23:59:59`)
          }
          
          const { data, error } = await ordersQuery
          
          if (!error && data && data.length > 0) {
            // Calcular días únicos
            const uniqueDates = new Set<string>()
            data.forEach((order: any) => {
              try {
                const date = new Date(order.orderDate)
                if (!isNaN(date.getTime())) {
                  uniqueDates.add(date.toISOString().split('T')[0])
                }
              } catch {}
            })
            
            const daysCount = uniqueDates.size || 1
            const totalTicketsFromSummary = orders
              .filter(o => o.idSaleOrder?.startsWith('SUMMARY-'))
              .length
            
            // Calcular factor de escala para promediar por día
            const scaleFactor = totalTicketsFromSummary > 0 && daysCount > 0
              ? totalTicketsFromSummary / (data.length * daysCount)
              : 1 / daysCount
            
            setRealOrdersForHours(data.map((o: any) => ({
              ...o,
              scaleFactor
            })) as any)
          }
        } catch (err) {
          console.error('Error obteniendo órdenes reales para horas:', err)
        } finally {
          setLoadingHours(false)
        }
      }
      
      fetchRealOrders()
    } else {
      setRealOrdersForHours([])
    }
  }, [hasSyntheticOrders, fromDate, toDate, orders.length])
  
  // Extraer días únicos para referencia
  const uniqueDates = new Set<string>()
  orders.forEach(order => {
    if (order.idSaleOrder?.startsWith('SUMMARY-')) {
      // Extraer fecha del ID: SUMMARY-2026-01-05-...
      const dateMatch = order.idSaleOrder.match(/SUMMARY-(\d{4}-\d{2}-\d{2})/)
      if (dateMatch) {
        uniqueDates.add(dateMatch[1])
      }
    } else {
      // Orden real, extraer fecha del orderDate
      try {
        const date = new Date(order.orderDate)
        if (!isNaN(date.getTime())) {
          uniqueDates.add(date.toISOString().split('T')[0])
        }
      } catch {}
    }
  })
  
  const numberOfDays = uniqueDates.size || 1
  
  // Usar órdenes reales si están disponibles, sino usar las órdenes recibidas
  const ordersToUse = hasSyntheticOrders && realOrdersForHours.length > 0 
    ? realOrdersForHours 
    : orders
  
  // Extract hour from orderDate and group by shop
  const hourlyData: Record<number, Record<string, number>> = {}
  
  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourlyData[i] = {}
  }

  ordersToUse.forEach((order: any) => {
    let hour: number
    const scaleFactor = order.scaleFactor || 1 // Factor de escala si viene de muestra
    
    // Si la orden es sintética (del resumen) y no tenemos órdenes reales, distribuir las horas
    if (order.idSaleOrder?.startsWith('SUMMARY-') && realOrdersForHours.length === 0) {
      // Distribuir uniformemente a lo largo del día (8am a 10pm)
      const orderIndex = parseInt(order.idSaleOrder.split('-').pop() || '0')
      hour = 8 + (orderIndex % 14) // 8am a 10pm (14 horas)
    } else {
      // Orden real, usar la hora real
      try {
        const date = new Date(order.orderDate)
        hour = date.getHours()
        if (isNaN(hour)) {
          hour = 12
        }
      } catch {
        hour = 12
      }
    }
    
    const shop = order.shopName
    
    if (!hourlyData[hour][shop]) {
      hourlyData[hour][shop] = 0
    }
    // Aplicar factor de escala si existe (para promedios diarios)
    hourlyData[hour][shop] += scaleFactor
  })

  // Get unique shops
  const shops = [...new Set(orders.map(o => o.shopName))]

  // Convert to chart format
  const chartData = Object.entries(hourlyData).map(([hour, shopCounts]) => {
    const data: Record<string, number> = { hour: `${parseInt(hour).toString().padStart(2, '0')}:00` }
    
    Object.entries(shopCounts).forEach(([shop, count]) => {
      // Redondear a 1 decimal para promedios
      data[shop] = Number(count.toFixed(1))
    })
    
    return data
  })

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label" style={{ marginBottom: '8px' }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
              <span style={{ color: entry.color }}>{entry.dataKey}</span>
              <span className="value">
                {entry.value} {hasSyntheticOrders ? 'tickets/día' : 'tickets'}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="card full-width">
      <div className="card-header">
        <span className="card-title">
          <Clock size={20} />
          Tickets por Hora
          {loadingHours && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)', 
              marginLeft: '8px',
              fontWeight: 'normal'
            }}>
              (Cargando...)
            </span>
          )}
          {hasSyntheticOrders && !loadingHours && (
            <span style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)', 
              marginLeft: '8px',
              fontWeight: 'normal'
            }}>
              (Promedio diario)
            </span>
          )}
        </span>
      </div>
      
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis 
            dataKey="hour" 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-color)' }}
          />
          <YAxis 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-color)' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={36}
            formatter={(value: string) => (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{value}</span>
            )}
          />
          {shops.map((shop) => (
            <Line
              key={shop}
              type="monotone"
              dataKey={shop}
              stroke={getShopColor(shop)}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

