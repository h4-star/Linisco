import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Calendar } from 'lucide-react'
import type { SaleOrder } from '../types/database'
import { getShopColor } from '../types/database'

interface DailySalesTrendChartProps {
  orders: SaleOrder[]
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

// Helper para extraer solo la fecha (YYYY-MM-DD) de un string de fecha
function extractDateOnly(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  
  // Si es formato ISO (2025-12-30T23:30:00 o 2025-12-30T23:30:00Z)
  const isoMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) {
    return isoMatch[1]
  }
  
  // Si es formato dd/mm/yyyy HH:mm:ss o dd/mm/yyyy
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  
  return null
}

// Formatear fecha para mostrar (DD/MM)
function formatDateForDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

export function DailySalesTrendChart({ orders }: DailySalesTrendChartProps) {
  // Agrupar órdenes por día y por local
  const dailyData: Record<string, Record<string, number>> = {}
  
  orders.forEach(order => {
    const dateStr = extractDateOnly(order.orderDate)
    if (!dateStr) return
    
    const shop = order.shopName
    
    if (!dailyData[dateStr]) {
      dailyData[dateStr] = {}
    }
    
    if (!dailyData[dateStr][shop]) {
      dailyData[dateStr][shop] = 0
    }
    
    dailyData[dateStr][shop] += order.total
  })

  // Obtener todos los locales únicos
  const shops = [...new Set(orders.map(o => o.shopName))]

  // Convertir a formato de gráfico y ordenar por fecha
  const chartData = Object.entries(dailyData)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, shopTotals]) => ({
      date,
      dateLabel: formatDateForDisplay(date),
      ...shopTotals
    }))

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0)
      return (
        <div className="custom-tooltip">
          <p className="label" style={{ marginBottom: '8px', fontWeight: 600 }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
              <span style={{ color: entry.color }}>{entry.dataKey}</span>
              <span className="value">{formatCurrency(entry.value || 0)}</span>
            </div>
          ))}
          <div style={{ 
            marginTop: '8px', 
            paddingTop: '8px', 
            borderTop: '1px solid var(--border-color)',
            display: 'flex', 
            justifyContent: 'space-between', 
            gap: '16px',
            fontWeight: 600
          }}>
            <span>Total</span>
            <span className="value">{formatCurrency(total)}</span>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card full-width">
      <div className="card-header">
        <span className="card-title">
          <Calendar size={20} />
          Tendencia Diaria de Ventas
        </span>
      </div>
      
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis 
            dataKey="dateLabel" 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-color)' }}
          />
          <YAxis 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-color)' }}
            tickFormatter={(value) => {
              if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
              if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
              return `$${value}`
            }}
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
            <Bar
              key={shop}
              dataKey={shop}
              stackId="sales"
              fill={getShopColor(shop)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
