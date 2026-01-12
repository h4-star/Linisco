import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CreditCard } from 'lucide-react'
import type { SaleOrder } from '../types/database'
import { getShopColor } from '../types/database'

interface PaymentMethodsChartProps {
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

// Función para categorizar métodos de pago
function categorizePaymentMethod(method: string): string {
  const methodLower = method?.toLowerCase() || ''
  
  if (methodLower.includes('efectivo') || methodLower.includes('cash')) {
    return 'Efectivo'
  }
  
  if (methodLower.includes('tarjeta') || methodLower.includes('card') || 
      methodLower.includes('visa') || methodLower.includes('master') ||
      methodLower.includes('credito') || methodLower.includes('debito')) {
    return 'Tarjetas'
  }
  
  if (methodLower.includes('mercado') && methodLower.includes('pago')) {
    return 'Mercado Pago'
  }
  
  if (methodLower.includes('rappi') || methodLower.includes('pedidos') || 
      methodLower.includes('uber') || methodLower.includes('delivery') ||
      methodLower.includes('app')) {
    return 'Apps Delivery'
  }
  
  return 'Otros'
}

export function PaymentMethodsChart({ orders }: PaymentMethodsChartProps) {
  // Group by categorized payment method and shop
  const dataByMethod: Record<string, Record<string, number>> = {}

  orders.forEach(order => {
    const method = categorizePaymentMethod(order.paymentmethod || 'Otro')
    const shop = order.shopName
    
    if (!dataByMethod[method]) {
      dataByMethod[method] = {}
    }
    if (!dataByMethod[method][shop]) {
      dataByMethod[method][shop] = 0
    }
    dataByMethod[method][shop] += order.total
  })

  // Get unique shops
  const shops = [...new Set(orders.map(o => o.shopName))]

  // Ordenar métodos de pago en orden específico
  const methodOrder = ['Efectivo', 'Tarjetas', 'Mercado Pago', 'Apps Delivery', 'Otros']
  
  // Convert to chart format, ordenado
  const chartData = methodOrder
    .filter(method => dataByMethod[method])
    .map(method => ({
      method,
      ...dataByMethod[method]
    }))

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label" style={{ marginBottom: '8px' }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
              <span style={{ color: entry.color }}>{entry.dataKey}</span>
              <span className="value">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <CreditCard size={20} />
          Ventas por Método de Pago
        </span>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis 
            dataKey="method" 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-color)' }}
          />
          <YAxis 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-color)' }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
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
              fill={getShopColor(shop)}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

