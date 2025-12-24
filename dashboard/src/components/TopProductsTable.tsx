import { ShoppingBag } from 'lucide-react'
import type { SaleProduct } from '../types/database'

interface TopProductsTableProps {
  products: SaleProduct[]
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

export function TopProductsTable({ products }: TopProductsTableProps) {
  // Aggregate products by name
  const productTotals = products.reduce((acc, product) => {
    if (!acc[product.name]) {
      acc[product.name] = { quantity: 0, total: 0 }
    }
    acc[product.name].quantity += product.quantity
    acc[product.name].total += product.total
    return acc
  }, {} as Record<string, { quantity: number; total: number }>)

  // Convert to array and sort by total
  const sortedProducts = Object.entries(productTotals)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <ShoppingBag size={20} />
          Top 10 Productos
        </span>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th style={{ textAlign: 'right' }}>Cantidad</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((product, index) => (
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
                  color: 'var(--accent-secondary)'
                }}>
                  {product.quantity}
                </td>
                <td style={{ 
                  textAlign: 'right', 
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-primary)',
                  fontWeight: 500
                }}>
                  {formatCurrency(product.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

