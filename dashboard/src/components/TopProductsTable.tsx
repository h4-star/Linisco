import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import type { SaleProduct } from '../types/database'

interface TopProductsTableProps {
  products: SaleProduct[]
}

type FilterType = 'todos' | 'subway' | 'daniel' | 'seitu'

export function TopProductsTable({ products }: TopProductsTableProps) {
  const [filter, setFilter] = useState<FilterType>('todos')

  // Filtrar productos según la selección
  const filteredProducts = products.filter(product => {
    if (filter === 'todos') return true
    if (filter === 'subway') return product.shopName?.toLowerCase().includes('subway')
    if (filter === 'daniel') return product.shopName?.toLowerCase().includes('daniel')
    if (filter === 'seitu') return product.shopName?.toLowerCase().includes('seitu')
    return true
  })

  // Aggregate products by name - solo cantidad
  const productTotals = filteredProducts.reduce((acc, product) => {
    const name = product.name || 'Sin nombre'
    if (!acc[name]) {
      acc[name] = { quantity: 0 }
    }
    const quantity = Number(product.quantity) || 0
    acc[name].quantity += quantity
    return acc
  }, {} as Record<string, { quantity: number }>)

  // Convert to array and sort by quantity
  const sortedProducts = Object.entries(productTotals)
    .map(([name, data]) => ({ name, quantity: data.quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10)

  const filters: { key: FilterType; label: string; color: string }[] = [
    { key: 'todos', label: 'Todos', color: 'var(--text-primary)' },
    { key: 'subway', label: 'Subway', color: '#00a651' },
    { key: 'daniel', label: 'Daniel', color: '#ff6b35' },
    { key: 'seitu', label: 'Seitu', color: '#8b5cf6' },
  ]

  return (
    <div className="card">
      <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
        <span className="card-title">
          <ShoppingBag size={20} />
          Top 10 Productos
        </span>
        
        {/* Filtros por tipo de local */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          flexWrap: 'wrap',
          width: '100%'
        }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: filter === f.key ? `2px solid ${f.color}` : '1px solid var(--border-color)',
                background: filter === f.key ? `${f.color}22` : 'var(--bg-secondary)',
                color: filter === f.key ? f.color : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: filter === f.key ? 600 : 400,
                transition: 'all 0.15s ease'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th style={{ textAlign: 'right' }}>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                  No hay productos para este filtro
                </td>
              </tr>
            ) : (
              sortedProducts.map((product, index) => (
                <tr key={product.name}>
                  <td style={{ 
                    fontFamily: 'var(--font-mono)', 
                    color: 'var(--text-muted)',
                    width: '40px'
                  }}>
                    {(index + 1).toString().padStart(2, '0')}
                  </td>
                  <td>{product.name}</td>
                  <td style={{ 
                    textAlign: 'right', 
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-secondary)',
                    fontWeight: 500
                  }}>
                    {product.quantity}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

