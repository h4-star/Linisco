import { useState, useEffect } from 'react'
import { 
  Package, Loader2, ChevronDown, ChevronUp,
  Filter, RefreshCw, Edit3, Save, X, Plus, DollarSign, TrendingUp
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { InventoryProduct, InventoryPurchase, ProductPrice, UnitOfMeasure } from '../../types/database'
import { SHOP_LIST, UNIT_OF_MEASURE_LABELS } from '../../types/database'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

interface ProductWithPrice extends InventoryProduct {
  current_price?: ProductPrice | null
  total_stock?: number
  total_value?: number
  weekly_consumption?: number
  monthly_consumption?: number
  initial_stock?: number
  initial_stock_date?: string | null
  calculated_stock?: number
  daily_utilization?: number
}

export function AdminInventoryPanel() {
  const [products, setProducts] = useState<ProductWithPrice[]>([])
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterShop, setFilterShop] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [updating, setUpdating] = useState<number | null>(null)
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null)
  const [showPriceForm, setShowPriceForm] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Price form state
  const [priceValue, setPriceValue] = useState('')
  const [priceDate, setPriceDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    fetchData()
  }, [filterShop])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchProducts(), fetchPurchases()])
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('inventory_products')
        .select('*')
        .eq('is_active', true)
        .order('shop_name', { ascending: true })
        .order('name', { ascending: true })

      if (filterShop) {
        query = query.eq('shop_name', filterShop)
      }

      const { data, error } = await query

      if (error) throw error

      // Obtener precios actuales para cada producto
      const productsWithPrices = await Promise.all(
        (data || []).map(async (product) => {
          // Obtener precio actual
          const { data: priceData } = await supabase
            .from('product_prices')
            .select('*')
            .eq('product_id', product.id)
            .eq('is_current', true)
            .single()

          // Obtener stock inicial (último snapshot marcado como inicial)
          const { data: initialStockData } = await supabase
            .from('inventory_stock_snapshots')
            .select('quantity, snapshot_date')
            .eq('product_id', product.id)
            .eq('shop_name', product.shop_name)
            .eq('is_initial_stock', true)
            .order('snapshot_date', { ascending: false })
            .limit(1)
            .single()

          const initialStock = initialStockData?.quantity || 0
          const initialStockDate = initialStockData?.snapshot_date || null

          // Calcular stock total (suma de compras)
          const { data: purchasesData } = await supabase
            .from('inventory_purchases')
            .select('quantity')
            .eq('product_id', product.id)
            .eq('shop_name', product.shop_name)

          const totalPurchases = purchasesData?.reduce((sum, p) => sum + p.quantity, 0) || 0
          const calculatedStock = initialStock + totalPurchases
          const totalValue = priceData ? calculatedStock * priceData.price : 0

          // Calcular utilización diaria promedio (últimos 30 días)
          const utilizationStartDate = initialStockDate 
            ? format(new Date(initialStockDate), 'yyyy-MM-dd')
            : format(subDays(new Date(), 30), 'yyyy-MM-dd')

          const { data: periodPurchases } = await supabase
            .from('inventory_purchases')
            .select('quantity, purchase_date')
            .eq('product_id', product.id)
            .eq('shop_name', product.shop_name)
            .gte('purchase_date', utilizationStartDate)

          const periodPurchasesTotal = periodPurchases?.reduce((sum, p) => sum + p.quantity, 0) || 0
          const daysInPeriod = initialStockDate 
            ? Math.max(1, Math.floor((new Date().getTime() - new Date(initialStockDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 30
          const dailyUtilization = daysInPeriod > 0 ? periodPurchasesTotal / daysInPeriod : 0

          // Calcular consumo
          const weeklyStart = subDays(new Date(), 7)
          const monthlyStart = subDays(new Date(), 30)

          const { data: weeklyPurchases } = await supabase
            .from('inventory_purchases')
            .select('quantity, purchase_date')
            .eq('product_id', product.id)
            .gte('purchase_date', format(weeklyStart, 'yyyy-MM-dd'))

          const { data: monthlyPurchases } = await supabase
            .from('inventory_purchases')
            .select('quantity, purchase_date')
            .eq('product_id', product.id)
            .gte('purchase_date', format(monthlyStart, 'yyyy-MM-dd'))

          const weeklyConsumption = weeklyPurchases?.reduce((sum, p) => sum + p.quantity, 0) || 0
          const monthlyConsumption = monthlyPurchases?.reduce((sum, p) => sum + p.quantity, 0) || 0

          return {
            id: product.id,
            user_id: product.user_id,
            name: product.name,
            unit_of_measure: product.unit_of_measure,
            category: product.category,
            description: product.description,
            shop_name: product.shop_name,
            is_active: product.is_active,
            created_at: product.created_at,
            updated_at: product.updated_at,
            current_price: priceData || null,
            total_stock: calculatedStock,
            total_value: totalValue,
            weekly_consumption: weeklyConsumption,
            monthly_consumption: monthlyConsumption,
            initial_stock: initialStock,
            initial_stock_date: initialStockDate,
            calculated_stock: calculatedStock,
            daily_utilization: dailyUtilization,
          } as ProductWithPrice
        })
      )

      setProducts(productsWithPrices)
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }

  const fetchPurchases = async () => {
    try {
      let query = supabase
        .from('inventory_purchases')
        .select(`
          *,
          product:inventory_products(*)
        `)
        .order('purchase_date', { ascending: false })
        .limit(500)

      if (filterShop) {
        query = query.eq('shop_name', filterShop)
      }

      const { data, error } = await query

      if (error) throw error
      setPurchases(data || [])
    } catch (err) {
      console.error('Error fetching purchases:', err)
    }
  }

  const handleAddPrice = async (productId: number) => {
    if (!priceValue || parseFloat(priceValue) <= 0) {
      setError('El precio debe ser mayor a 0')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      // Primero, marcar todos los precios anteriores como no actuales
      await supabase
        .from('product_prices')
        .update({ is_current: false } as any)
        .eq('product_id', productId)

      // Crear nuevo precio
      const { error: insertError } = await supabase
        .from('product_prices')
        .insert({
          product_id: productId,
          user_id: user.id,
          price: parseFloat(priceValue),
          effective_date: priceDate,
          is_current: true,
        } as any)

      if (insertError) throw insertError

      setPriceValue('')
      setPriceDate(format(new Date(), 'yyyy-MM-dd'))
      setShowPriceForm(null)
      setError(null)
      fetchProducts()
    } catch (err: any) {
      console.error('Error guardando precio:', err)
      setError(`Error: ${err.message || 'Intenta de nuevo'}`)
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value)
  }

  const filteredProducts = products.filter(p => {
    if (filterShop && p.shop_name !== filterShop) return false
    if (filterCategory && p.category !== filterCategory) return false
    return true
  })

  // Calcular totales
  const totalInventoryValue = filteredProducts.reduce((sum, p) => sum + (p.total_value || 0), 0)
  const totalProducts = filteredProducts.length
  const productsWithPrice = filteredProducts.filter(p => p.current_price).length
  const productsWithoutPrice = totalProducts - productsWithPrice

  // Obtener categorías únicas
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)))

  if (loading) {
    return (
      <div className="admin-panel-loading">
        <Loader2 size={32} className="spinning" />
        <p>Cargando inventario...</p>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h1>Inventario</h1>
          <p>Gestión de inventario y precios</p>
        </div>
        <div className="admin-panel-actions">
          <button 
            className="btn-secondary"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={18} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="admin-filters">
        <div className="filter-group">
          <Filter size={18} />
          <select 
            value={filterShop} 
            onChange={(e) => setFilterShop(e.target.value)}
          >
            <option value="">Todos los locales</option>
            {SHOP_LIST.map(shop => (
              <option key={shop} value={shop}>{shop}</option>
            ))}
          </select>
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map(cat => (
              <option key={cat || ''} value={cat || ''}>{cat || ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total productos</span>
          <span className="stat-value">{totalProducts}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Valor total inventario</span>
          <span className="stat-value">{formatCurrency(totalInventoryValue)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Con precio</span>
          <span className="stat-value">{productsWithPrice}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Sin precio</span>
          <span className="stat-value" style={{ color: '#ef4444' }}>{productsWithoutPrice}</span>
        </div>
      </div>

      <div className="admin-list">
        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <h3>Sin productos</h3>
            <p>No hay productos que coincidan con los filtros</p>
          </div>
        ) : (
          filteredProducts.map(product => (
            <div 
              key={product.id} 
              className={`admin-card ${expandedId === product.id ? 'expanded' : ''}`}
            >
              <button 
                className="admin-card-header"
                onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}
              >
                <div className="admin-card-info">
                  <span className="card-title">{product.name}</span>
                  <span className="card-subtitle">
                    {product.shop_name} • {UNIT_OF_MEASURE_LABELS[product.unit_of_measure as UnitOfMeasure] || product.unit_of_measure}
                  </span>
                  {product.category && (
                    <span className="card-badge">{product.category}</span>
                  )}
                  {product.current_price && (
                    <span className="card-badge" style={{ background: '#10b981' }}>
                      ${formatNumber(product.current_price.price)}
                    </span>
                  )}
                </div>
                <div className="admin-card-total">
                  {product.total_value ? (
                    <span>{formatCurrency(product.total_value)}</span>
                  ) : (
                    <span style={{ color: '#ef4444' }}>Sin precio</span>
                  )}
                </div>
                {expandedId === product.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {expandedId === product.id && (
                <div className="admin-card-body">
                  {showPriceForm === product.id ? (
                    <div className="edit-form">
                      <h4>Agregar precio</h4>
                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Precio *</label>
                          <input
                            type="number"
                            value={priceValue}
                            onChange={(e) => setPriceValue(e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Fecha de vigencia *</label>
                          <input
                            type="date"
                            value={priceDate}
                            onChange={(e) => setPriceDate(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      {error && <div className="form-error">{error}</div>}
                      <div className="form-actions">
                        <button 
                          className="btn-secondary"
                          onClick={() => {
                            setShowPriceForm(null)
                            setError(null)
                            setPriceValue('')
                          }}
                        >
                          Cancelar
                        </button>
                        <button 
                          className="btn-primary"
                          onClick={() => handleAddPrice(product.id)}
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader2 size={18} className="spinning" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Save size={18} />
                              Guardar precio
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="admin-card-details">
                        <div className="detail-group">
                          <h5>Información</h5>
                          <div className="detail-row">
                            <span>Nombre:</span>
                            <span>{product.name}</span>
                          </div>
                          <div className="detail-row">
                            <span>Local:</span>
                            <span>{product.shop_name}</span>
                          </div>
                          <div className="detail-row">
                            <span>Unidad de medida:</span>
                            <span>{UNIT_OF_MEASURE_LABELS[product.unit_of_measure as UnitOfMeasure] || product.unit_of_measure}</span>
                          </div>
                          {product.category && (
                            <div className="detail-row">
                              <span>Categoría:</span>
                              <span>{product.category}</span>
                            </div>
                          )}
                          {product.description && (
                            <div className="detail-row">
                              <span>Descripción:</span>
                              <span>{product.description}</span>
                            </div>
                          )}
                        </div>
                        <div className="detail-group">
                          <h5>Stock y Valor</h5>
                          <div className="detail-row">
                            <span>Stock total:</span>
                            <span>{formatNumber(product.total_stock || 0)} {product.unit_of_measure}</span>
                          </div>
                          {product.current_price && (
                            <>
                              <div className="detail-row">
                                <span>Precio unitario:</span>
                                <span>{formatCurrency(product.current_price.price)}</span>
                              </div>
                              <div className="detail-row">
                                <span>Fecha precio:</span>
                                <span>{format(new Date(product.current_price.effective_date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</span>
                              </div>
                            </>
                          )}
                          <div className="detail-row">
                            <span><strong>Valor total:</strong></span>
                            <span><strong>{formatCurrency(product.total_value || 0)}</strong></span>
                          </div>
                        </div>
                        <div className="detail-group">
                          <h5>Consumo</h5>
                          <div className="detail-row">
                            <span>Última semana:</span>
                            <span>{formatNumber(product.weekly_consumption || 0)} {product.unit_of_measure}</span>
                          </div>
                          <div className="detail-row">
                            <span>Último mes:</span>
                            <span>{formatNumber(product.monthly_consumption || 0)} {product.unit_of_measure}</span>
                          </div>
                        </div>
                        <div className="detail-group">
                          <h5>Utilización del Período</h5>
                          {product.initial_stock_date && (
                            <div className="detail-row">
                              <span>Stock inicial ({format(new Date(product.initial_stock_date + 'T12:00:00'), "d/M/yyyy", { locale: es })}):</span>
                              <span>{formatNumber(product.initial_stock || 0)} {product.unit_of_measure}</span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span>Compras totales:</span>
                            <span>{formatNumber((product.calculated_stock || 0) - (product.initial_stock || 0))} {product.unit_of_measure}</span>
                          </div>
                          <div className="detail-row">
                            <span><strong>Stock actual calculado:</strong></span>
                            <span><strong>{formatNumber(product.calculated_stock || 0)} {product.unit_of_measure}</strong></span>
                          </div>
                          {product.daily_utilization !== undefined && product.daily_utilization > 0 && (
                            <div className="detail-row">
                              <span>Utilización diaria promedio:</span>
                              <span>{formatNumber(product.daily_utilization, 3)} {product.unit_of_measure}/día</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="admin-card-actions">
                        <button 
                          className="btn-primary"
                          onClick={() => {
                            setShowPriceForm(product.id)
                            setPriceValue(product.current_price?.price.toString() || '')
                            setPriceDate(format(new Date(), 'yyyy-MM-dd'))
                          }}
                        >
                          <DollarSign size={16} />
                          {product.current_price ? 'Actualizar precio' : 'Agregar precio'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
