import { AlertTriangle } from 'lucide-react'
import type { SaleOrder } from '../types/database'

interface BlackSalesCardProps {
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

export function BlackSalesCard({ orders }: BlackSalesCardProps) {
  // Calculate "black" sales (number === 0 means no fiscal ticket)
  const blackSales = orders.filter(o => o.number === 0)
  const blackTotal = blackSales.reduce((sum, o) => sum + o.total, 0)
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0)
  
  const blackPercentage = totalSales > 0 ? (blackTotal / totalSales) * 100 : 0
  const blackIVA = (blackTotal / 1.21) - blackTotal // IVA no facturado

  return (
    <div className="card" style={{ 
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
      borderColor: 'rgba(239, 68, 68, 0.3)'
    }}>
      <div className="card-header">
        <span className="card-title" style={{ color: '#ef4444' }}>
          <AlertTriangle size={20} />
          Ventas sin Facturar
        </span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div style={{ 
            fontSize: '1.75rem', 
            fontWeight: 700, 
            fontFamily: 'var(--font-mono)',
            color: '#ef4444'
          }}>
            {formatCurrency(blackTotal)}
          </div>
          <div className="stat-label">Total sin facturar</div>
        </div>
        
        <div>
          <div style={{ 
            fontSize: '1.75rem', 
            fontWeight: 700, 
            fontFamily: 'var(--font-mono)',
            color: '#f59e0b'
          }}>
            {blackPercentage.toFixed(1)}%
          </div>
          <div className="stat-label">del total de ventas</div>
        </div>
      </div>

      <div style={{ 
        marginTop: '20px', 
        padding: '12px', 
        background: 'rgba(0,0,0,0.2)', 
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>IVA no facturado</span>
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          color: '#ef4444',
          fontWeight: 600
        }}>
          {formatCurrency(Math.abs(blackIVA))}
        </span>
      </div>
    </div>
  )
}

