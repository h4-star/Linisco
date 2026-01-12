import { memo, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'
import type { SaleOrder } from '../types/database'
import { getShopColor } from '../types/database'

interface SalesByShopChartProps {
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

export const SalesByShopChart = memo(function SalesByShopChart({ orders }: SalesByShopChartProps) {
  // Group by shop and sum totals - Memoizar para evitar recálculos
  const { chartData, total } = useMemo(() => {
    const dataByShop = orders.reduce((acc, order) => {
      const shop = order.shopName
      if (!acc[shop]) {
        acc[shop] = 0
      }
      acc[shop] += order.total
      return acc
    }, {} as Record<string, number>)

    const data = Object.entries(dataByShop).map(([name, value]) => ({
      name,
      value,
      color: getShopColor(name)
    }))

    const totalValue = data.reduce((sum, item) => sum + item.value, 0)
    
    return { chartData: data, total: totalValue }
  }, [orders])

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const percentage = ((data.value / total) * 100).toFixed(1)
      return (
        <div className="custom-tooltip">
          <p className="label">{data.name}</p>
          <p className="value">{formatCurrency(data.value)}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{percentage}% del total</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <PieChartIcon size={20} />
          Ventas por Local
        </span>
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          fontSize: '0.9rem',
          color: 'var(--accent-primary)'
        }}>
          Total: {formatCurrency(total / 1.21)} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>sin IVA</span>
        </span>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={3}
            dataKey="value"
            stroke="var(--bg-primary)"
            strokeWidth={2}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value: string) => (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
})

