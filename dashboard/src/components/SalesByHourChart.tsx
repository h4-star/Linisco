import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Clock } from 'lucide-react'
import type { SaleOrder } from '../types/database'
import { getShopColor } from '../types/database'

interface SalesByHourChartProps {
  orders: SaleOrder[]
}

export function SalesByHourChart({ orders }: SalesByHourChartProps) {
  // Extract hour from orderDate and group by shop
  const hourlyData: Record<number, Record<string, number>> = {}
  
  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    hourlyData[i] = {}
  }

  orders.forEach(order => {
    const date = new Date(order.orderDate)
    const hour = date.getHours()
    const shop = order.shopName
    
    if (!hourlyData[hour][shop]) {
      hourlyData[hour][shop] = 0
    }
    hourlyData[hour][shop]++
  })

  // Get unique shops
  const shops = [...new Set(orders.map(o => o.shopName))]

  // Convert to chart format
  const chartData = Object.entries(hourlyData).map(([hour, shopCounts]) => ({
    hour: `${hour.padStart(2, '0')}:00`,
    ...shopCounts
  }))

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label" style={{ marginBottom: '8px' }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
              <span style={{ color: entry.color }}>{entry.dataKey}</span>
              <span className="value">{entry.value} tickets</span>
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

