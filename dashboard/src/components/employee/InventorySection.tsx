import { useState, useEffect, useMemo } from 'react'
import { 
  Package, Save, Loader2, Plus, X,
  ChevronDown, ChevronUp, ShoppingCart, TrendingUp, ClipboardList
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { InventoryProduct, InventoryPurchase, InventoryStockSnapshot, UnitOfMeasure } from '../../types/database'
import { SHOP_LIST, UNIT_OF_MEASURE_LABELS } from '../../types/database'
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

interface InventorySectionProps {
  userId: string
  assignedShops: string[]
}

type Tab = 'products' | 'purchases' | 'stock'

export function InventorySection({ userId, assignedShops }: InventorySectionProps) {
  const [activeTab, setActiveTab] = useState<Tab>('products')
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([])
  const [stockSnapshots, setStockSnapshots] = useState<InventoryStockSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showProductForm, setShowProductForm] = useState(false)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [showStockForm, setShowStockForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Product form state
  const [productName, setProductName] = useState('')
  const [productUnit, setProductUnit] = useState<UnitOfMeasure>('unidades')
  const [productCategory, setProductCategory] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productShop, setProductShop] = useState(assignedShops[0] || '')

  // Purchase form state
  const [purchaseProductId, setPurchaseProductId] = useState<number | null>(null)
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [purchaseQuantity, setPurchaseQuantity] = useState('')
  const [purchaseUnit, setPurchaseUnit] = useState('')
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState('')
  const [purchaseShop, setPurchaseShop] = useState(assignedShops[0] || '')
  const [purchaseSupplier, setPurchaseSupplier] = useState('')
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState('')
  const [purchaseNotes, setPurchaseNotes] = useState('')

  // Stock snapshot form state
  const [stockProductId, setStockProductId] = useState<number | null>(null)
  const [stockDate, setStockDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [stockQuantity, setStockQuantity] = useState('')
  const [stockUnit, setStockUnit] = useState('')
  const [stockShop, setStockShop] = useState(assignedShops[0] || '')
  const [stockNotes, setStockNotes] = useState('')
  const [isInitialStock, setIsInitialStock] = useState(true)

  const shopOptions = assignedShops.length > 0 ? assignedShops : SHOP_LIST

  useEffect(() => {
    fetchData()
  }, [userId, activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'products') {
        await fetchProducts()
      } else if (activeTab === 'purchases') {
        await fetchPurchases()
        await fetchProducts() // Necesitamos los productos para el selector
      } else if (activeTab === 'stock') {
        await fetchStockSnapshots()
        await fetchProducts() // Necesitamos los productos para el selector
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_products')
        .select('*')
        .eq('shop_name', purchaseShop || productShop || shopOptions[0])
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }

  const fetchPurchases = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_purchases')
        .select(`
          *,
          product:inventory_products(*)
        `)
        .eq('shop_name', purchaseShop || shopOptions[0])
        .order('purchase_date', { ascending: false })
        .limit(100)

      if (error) throw error
      setPurchases(data || [])
    } catch (err) {
      console.error('Error fetching purchases:', err)
    }
  }

  const fetchStockSnapshots = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_stock_snapshots')
        .select(`
          *,
          product:inventory_products(*)
        `)
        .eq('shop_name', stockShop || shopOptions[0])
        .order('snapshot_date', { ascending: false })
        .limit(100)

      if (error) throw error
      setStockSnapshots(data || [])
    } catch (err) {
      console.error('Error fetching stock snapshots:', err)
    }
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productName || !productShop) {
      setError('El nombre del producto y el local son obligatorios')
      return
    }

    setSaving(true)
    setError(null)
    
    try {
      // Obtener el usuario autenticado actual para asegurar que user_id coincida
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        setError('Error de autenticación. Por favor, recarga la página.')
        return
      }

      const insertData = {
        user_id: authUser.id, // Usar el ID del usuario autenticado
        name: productName.trim(),
        unit_of_measure: productUnit,
        category: productCategory.trim() || null,
        description: productDescription.trim() || null,
        shop_name: productShop,
        is_active: true,
      }
      
      // Debug: mostrar datos antes de insertar
      console.log('🔍 Insertando producto con datos:', insertData)
      console.log('🔍 Usuario autenticado ID:', authUser.id)
      console.log('🔍 Tipo de user_id:', typeof authUser.id)
      
      // Verificar que el usuario tenga perfil en user_profiles
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', authUser.id)
        .single()
      
      if (profileError || !profile) {
        console.warn('⚠️ Usuario no tiene perfil en user_profiles, intentando crear...')
        // Intentar crear el perfil si no existe
        const { error: createProfileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            role: authUser.email === 'h4subway@gmail.com' ? 'admin' : 'employee',
            is_active: true
          } as any)
          .select()
        
        if (createProfileError) {
          console.error('❌ Error creando perfil:', createProfileError)
          setError('Error: El usuario no tiene perfil. Contacta al administrador.')
          return
        }
      }
      
      const { error: insertError, data: insertedData } = await supabase
        .from('inventory_products')
        .insert(insertData as any)
        .select()

      if (insertError) {
        console.error('❌ Error completo de Supabase:', insertError)
        console.error('❌ Código de error:', insertError.code)
        console.error('❌ Mensaje:', insertError.message)
        console.error('❌ Detalles:', insertError.details)
        console.error('❌ Hint:', insertError.hint)
        console.error('❌ Datos que intentamos insertar:', insertData)
        
        if (insertError.code === '23505') {
          setError('Ya existe un producto con este nombre en este local')
        } else if (insertError.code === '42501') {
          setError('Error de permisos RLS. Verifica que las políticas estén configuradas correctamente.')
        } else {
          setError(`Error: ${insertError.message || insertError.code || 'Error desconocido'}`)
        }
        return
      }
      
      console.log('✅ Producto insertado correctamente:', insertedData)

      // Reset form
      setProductName('')
      setProductUnit('unidades')
      setProductCategory('')
      setProductDescription('')
      setShowProductForm(false)
      setError(null)
      fetchProducts()
    } catch (err: any) {
      console.error('Error guardando producto:', err)
      setError(`Error inesperado: ${err.message || 'Intenta de nuevo'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!purchaseProductId || !purchaseDate || !purchaseQuantity || !purchaseShop) {
      setError('El producto, fecha, cantidad y local son obligatorios')
      return
    }

    setSaving(true)
    setError(null)
    
    try {
      const selectedProduct = products.find(p => p.id === purchaseProductId)
      if (!selectedProduct) {
        setError('Producto no encontrado')
        return
      }

      // Obtener el usuario autenticado actual para asegurar que user_id coincida
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        setError('Error de autenticación. Por favor, recarga la página.')
        return
      }

      const quantityNum = parseFloat(purchaseQuantity) || 0
      const unitPriceNum = parseFloat(purchaseUnitPrice) || 0
      const totalAmount = unitPriceNum > 0 ? quantityNum * unitPriceNum : null

      const insertData = {
        user_id: authUser.id, // Usar el ID del usuario autenticado
        product_id: purchaseProductId,
        purchase_date: purchaseDate,
        quantity: quantityNum,
        unit_of_measure: selectedProduct.unit_of_measure,
        unit_price: unitPriceNum > 0 ? unitPriceNum : null,
        total_amount: totalAmount,
        shop_name: purchaseShop,
        supplier_name: purchaseSupplier.trim() || null,
        invoice_number: purchaseInvoiceNumber.trim() || null,
        notes: purchaseNotes.trim() || null,
      }
      
      const { error: insertError } = await supabase
        .from('inventory_purchases')
        .insert(insertData as any)
        .select()

      if (insertError) {
        console.error('Error completo de Supabase:', insertError)
        console.error('Código de error:', insertError.code)
        console.error('Mensaje:', insertError.message)
        console.error('Detalles:', insertError.details)
        console.error('Hint:', insertError.hint)
        
        if (insertError.code === '42501') {
          setError('Error de permisos RLS. Verifica que las políticas estén configuradas correctamente.')
        } else {
          setError(`Error: ${insertError.message || insertError.code || 'Error desconocido'}`)
        }
        return
      }

      // Reset form
      setPurchaseProductId(null)
      setPurchaseDate(format(new Date(), 'yyyy-MM-dd'))
      setPurchaseQuantity('')
      setPurchaseUnit('')
      setPurchaseUnitPrice('')
      setPurchaseSupplier('')
      setPurchaseInvoiceNumber('')
      setPurchaseNotes('')
      setShowPurchaseForm(false)
      setError(null)
      fetchPurchases()
    } catch (err: any) {
      console.error('Error guardando compra:', err)
      setError(`Error inesperado: ${err.message || 'Intenta de nuevo'}`)
    } finally {
      setSaving(false)
    }
  }

  // Calcular consumo
  const calculateConsumption = (productId: number, days: number = 7) => {
    const startDate = subDays(new Date(), days)
    return purchases
      .filter(p => p.product_id === productId && new Date(p.purchase_date) >= startDate)
      .reduce((sum, p) => sum + p.quantity, 0)
  }

  // Calcular utilización (stock inicial + compras)
  const calculateUtilization = async (productId: number, shopName: string, days: number = 30) => {
    try {
      // Obtener stock inicial (último snapshot marcado como inicial)
      const { data: initialStock } = await supabase
        .from('inventory_stock_snapshots')
        .select('quantity, snapshot_date')
        .eq('product_id', productId)
        .eq('shop_name', shopName)
        .eq('is_initial_stock', true)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single()

      const initialStockQty = initialStock?.quantity || 0
      const initialStockDate = initialStock?.snapshot_date || null

      // Obtener compras del período
      const startDate = initialStockDate 
        ? format(new Date(initialStockDate), 'yyyy-MM-dd')
        : format(subDays(new Date(), days), 'yyyy-MM-dd')

      const { data: periodPurchases } = await supabase
        .from('inventory_purchases')
        .select('quantity, purchase_date')
        .eq('product_id', productId)
        .eq('shop_name', shopName)
        .gte('purchase_date', startDate)

      const totalPurchases = periodPurchases?.reduce((sum, p) => sum + p.quantity, 0) || 0
      const daysInPeriod = initialStockDate 
        ? Math.max(1, Math.floor((new Date().getTime() - new Date(initialStockDate).getTime()) / (1000 * 60 * 60 * 24)))
        : days

      return {
        initialStock: initialStockQty,
        initialStockDate,
        totalPurchases,
        calculatedStock: initialStockQty + totalPurchases,
        dailyUtilization: daysInPeriod > 0 ? totalPurchases / daysInPeriod : 0,
        daysInPeriod
      }
    } catch (err) {
      console.error('Error calculating utilization:', err)
      return {
        initialStock: 0,
        initialStockDate: null,
        totalPurchases: 0,
        calculatedStock: 0,
        dailyUtilization: 0,
        daysInPeriod: 0
      }
    }
  }

  const handleCreateStockSnapshot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockProductId || !stockDate || !stockQuantity || !stockShop) {
      setError('El producto, fecha, cantidad y local son obligatorios')
      return
    }

    setSaving(true)
    setError(null)
    
    try {
      const selectedProduct = products.find(p => p.id === stockProductId)
      if (!selectedProduct) {
        setError('Producto no encontrado')
        return
      }

      // Obtener el usuario autenticado actual
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        setError('Error de autenticación. Por favor, recarga la página.')
        return
      }

      // Verificar que el usuario tenga perfil
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', authUser.id)
        .single()
      
      if (profileError || !profile) {
        const { error: createProfileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            role: authUser.email === 'h4subway@gmail.com' ? 'admin' : 'employee',
            is_active: true
          } as any)
        
        if (createProfileError) {
          setError('Error: El usuario no tiene perfil. Contacta al administrador.')
          return
        }
      }

      const insertData = {
        user_id: authUser.id,
        product_id: stockProductId,
        snapshot_date: stockDate,
        quantity: parseFloat(stockQuantity) || 0,
        unit_of_measure: selectedProduct.unit_of_measure,
        shop_name: stockShop,
        notes: stockNotes.trim() || null,
        is_initial_stock: isInitialStock,
      }
      
      const { error: insertError } = await supabase
        .from('inventory_stock_snapshots')
        .insert(insertData as any)
        .select()

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Ya existe una existencia para este producto, fecha y local')
        } else {
          setError(`Error: ${insertError.message}`)
        }
        return
      }

      // Reset form
      setStockProductId(null)
      setStockDate(format(new Date(), 'yyyy-MM-dd'))
      setStockQuantity('')
      setStockUnit('')
      setStockNotes('')
      setIsInitialStock(true)
      setShowStockForm(false)
      setError(null)
      fetchStockSnapshots()
    } catch (err: any) {
      console.error('Error guardando existencia:', err)
      setError(`Error inesperado: ${err.message || 'Intenta de nuevo'}`)
    } finally {
      setSaving(false)
    }
  }

  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value)
  }

  // Componente para mostrar utilización de un producto
  function ProductUtilization({ 
    productId, 
    shopName, 
    unitOfMeasure,
    calculateUtilization 
  }: { 
    productId: number
    shopName: string
    unitOfMeasure: string
    calculateUtilization: (productId: number, shopName: string, days: number) => Promise<{
      initialStock: number
      initialStockDate: string | null
      totalPurchases: number
      calculatedStock: number
      dailyUtilization: number
      daysInPeriod: number
    }>
  }) {
    const [utilization, setUtilization] = useState<{
      initialStock: number
      initialStockDate: string | null
      totalPurchases: number
      calculatedStock: number
      dailyUtilization: number
      daysInPeriod: number
    } | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      setLoading(true)
      calculateUtilization(productId, shopName, 30).then(result => {
        setUtilization(result)
        setLoading(false)
      })
    }, [productId, shopName])

    if (loading) {
      return (
        <div className="detail-group">
          <h5>Utilización</h5>
          <div className="detail-row">
            <span>Cargando...</span>
          </div>
        </div>
      )
    }

    if (!utilization) return null

    return (
      <div className="detail-group">
        <h5>Utilización del Período</h5>
        {utilization.initialStockDate && (
          <div className="detail-row">
            <span>Stock inicial ({format(new Date(utilization.initialStockDate + 'T12:00:00'), "d/M/yyyy", { locale: es })}):</span>
            <span>{formatNumber(utilization.initialStock)} {unitOfMeasure}</span>
          </div>
        )}
        <div className="detail-row">
          <span>Compras del período:</span>
          <span>{formatNumber(utilization.totalPurchases)} {unitOfMeasure}</span>
        </div>
        <div className="detail-row">
          <span><strong>Stock actual calculado:</strong></span>
          <span><strong>{formatNumber(utilization.calculatedStock)} {unitOfMeasure}</strong></span>
        </div>
        {utilization.daysInPeriod > 0 && (
          <div className="detail-row">
            <span>Utilización diaria promedio:</span>
            <span>{formatNumber(utilization.dailyUtilization, 3)} {unitOfMeasure}/día</span>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="section-loading">
        <Loader2 size={32} className="spinning" />
        <p>Cargando inventario...</p>
      </div>
    )
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="section-icon">
          <Package size={24} />
        </div>
        <div>
          <h1>Inventario</h1>
          <p>Gestiona productos y compras de inventario</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="inventory-tabs">
        <button
          className={`inventory-tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <Package size={18} />
          Productos
        </button>
        <button
          className={`inventory-tab ${activeTab === 'purchases' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchases')}
        >
          <ShoppingCart size={18} />
          Compras
        </button>
        <button
          className={`inventory-tab ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          <ClipboardList size={18} />
          Existencias
        </button>
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <>
          <div className="section-actions">
            <button 
              className="btn-primary"
              onClick={() => setShowProductForm(!showProductForm)}
            >
              <Plus size={18} />
              Nuevo producto
            </button>
          </div>

          {showProductForm && (
            <div className="closing-form-card">
              <div className="form-header">
                <h3>Nuevo producto</h3>
                <button 
                  className="icon-button"
                  onClick={() => {
                    setShowProductForm(false)
                    setError(null)
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateProduct}>
                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Nombre del producto *</label>
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Ej: Pan de molde"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Local *</label>
                    <select 
                      value={productShop} 
                      onChange={(e) => setProductShop(e.target.value)}
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {shopOptions.map(shop => (
                        <option key={shop} value={shop}>{shop}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Unidad de medida *</label>
                    <select 
                      value={productUnit} 
                      onChange={(e) => setProductUnit(e.target.value as UnitOfMeasure)}
                      required
                    >
                      {Object.entries(UNIT_OF_MEASURE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Categoría (opcional)</label>
                    <input
                      type="text"
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      placeholder="Ej: Insumos, Bebidas, Limpieza"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Descripción (opcional)</label>
                  <textarea
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    placeholder="Descripción adicional del producto..."
                    rows={2}
                  />
                </div>
                {error && <div className="form-error">{error}</div>}
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={() => {
                      setShowProductForm(false)
                      setError(null)
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
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
                        Guardar producto
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="closings-list">
            {products.length === 0 ? (
              <div className="empty-state">
                <Package size={48} />
                <h3>Sin productos</h3>
                <p>Todavia no creaste ningún producto en este local</p>
              </div>
            ) : (
              products.map(product => {
                const weeklyConsumption = calculateConsumption(product.id, 7)
                const monthlyConsumption = calculateConsumption(product.id, 30)
                return (
                  <div 
                    key={product.id} 
                    className={`closing-card ${expandedId === product.id ? 'expanded' : ''}`}
                  >
                    <button 
                      className="closing-header"
                      onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}
                    >
                      <div className="closing-info">
                        <span className="closing-shop">{product.name}</span>
                        <span className="closing-date">{product.shop_name}</span>
                        <span className="closing-shift">
                          {UNIT_OF_MEASURE_LABELS[product.unit_of_measure as UnitOfMeasure] || product.unit_of_measure}
                        </span>
                        {product.category && (
                          <span className="closing-shift">{product.category}</span>
                        )}
                      </div>
                      <div className="closing-total">
                        <span className="total-label">Consumo semanal:</span>
                        <span className="total-value">{formatNumber(weeklyConsumption)}</span>
                      </div>
                      {expandedId === product.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {expandedId === product.id && (
                      <div className="closing-body">
                        <div className="closing-details">
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
                            <h5>Consumo</h5>
                            <div className="detail-row">
                              <span>Última semana:</span>
                              <span>{formatNumber(weeklyConsumption)} {product.unit_of_measure}</span>
                            </div>
                            <div className="detail-row">
                              <span>Último mes:</span>
                              <span>{formatNumber(monthlyConsumption)} {product.unit_of_measure}</span>
                            </div>
                          </div>
                          <ProductUtilization 
                            productId={product.id} 
                            shopName={product.shop_name}
                            unitOfMeasure={product.unit_of_measure}
                            calculateUtilization={calculateUtilization}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Purchases Tab */}
      {activeTab === 'purchases' && (
        <>
          <div className="section-actions">
            <select
              value={purchaseShop}
              onChange={(e) => {
                setPurchaseShop(e.target.value)
                fetchPurchases()
              }}
              className="shop-selector"
            >
              {shopOptions.map(shop => (
                <option key={shop} value={shop}>{shop}</option>
              ))}
            </select>
            <button 
              className="btn-primary"
              onClick={() => setShowPurchaseForm(!showPurchaseForm)}
            >
              <Plus size={18} />
              Nueva compra
            </button>
          </div>

          {showPurchaseForm && (
            <div className="closing-form-card">
              <div className="form-header">
                <h3>Nueva compra</h3>
                <button 
                  className="icon-button"
                  onClick={() => {
                    setShowPurchaseForm(false)
                    setError(null)
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreatePurchase}>
                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Producto *</label>
                    <select 
                      value={purchaseProductId || ''} 
                      onChange={(e) => {
                        const productId = parseInt(e.target.value)
                        setPurchaseProductId(productId)
                        const product = products.find(p => p.id === productId)
                        if (product) {
                          setPurchaseUnit(product.unit_of_measure)
                        }
                      }}
                      required
                    >
                      <option value="">Seleccionar producto...</option>
                      {products
                        .filter(p => p.shop_name === purchaseShop)
                        .map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.unit_of_measure})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Local *</label>
                    <select 
                      value={purchaseShop} 
                      onChange={(e) => {
                        setPurchaseShop(e.target.value)
                        fetchProducts()
                      }}
                      required
                    >
                      {shopOptions.map(shop => (
                        <option key={shop} value={shop}>{shop}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row three-cols">
                  <div className="form-group">
                    <label>Fecha *</label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Cantidad *</label>
                    <input
                      type="number"
                      value={purchaseQuantity}
                      onChange={(e) => setPurchaseQuantity(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unidad</label>
                    <input
                      type="text"
                      value={purchaseUnit}
                      readOnly
                      disabled
                      style={{ opacity: 0.6 }}
                    />
                  </div>
                </div>
                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Precio unitario (opcional)</label>
                    <input
                      type="number"
                      value={purchaseUnitPrice}
                      onChange={(e) => setPurchaseUnitPrice(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label>Proveedor (opcional)</label>
                    <input
                      type="text"
                      value={purchaseSupplier}
                      onChange={(e) => setPurchaseSupplier(e.target.value)}
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                </div>
                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Número de factura (opcional)</label>
                    <input
                      type="text"
                      value={purchaseInvoiceNumber}
                      onChange={(e) => setPurchaseInvoiceNumber(e.target.value)}
                      placeholder="0001-00001234"
                    />
                  </div>
                  <div className="form-group">
                    <label>Notas (opcional)</label>
                    <input
                      type="text"
                      value={purchaseNotes}
                      onChange={(e) => setPurchaseNotes(e.target.value)}
                      placeholder="Observaciones..."
                    />
                  </div>
                </div>
                {error && <div className="form-error">{error}</div>}
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={() => {
                      setShowPurchaseForm(false)
                      setError(null)
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
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
                        Guardar compra
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="closings-list">
            {purchases.length === 0 ? (
              <div className="empty-state">
                <ShoppingCart size={48} />
                <h3>Sin compras</h3>
                <p>Todavia no cargaste ninguna compra en este local</p>
              </div>
            ) : (
              purchases.map(purchase => (
                <div 
                  key={purchase.id} 
                  className={`closing-card ${expandedId === purchase.id ? 'expanded' : ''}`}
                >
                  <button 
                    className="closing-header"
                    onClick={() => setExpandedId(expandedId === purchase.id ? null : purchase.id)}
                  >
                    <div className="closing-info">
                      <span className="closing-shop">
                        {purchase.product?.name || 'Producto eliminado'}
                      </span>
                      <span className="closing-date">
                        {format(new Date(purchase.purchase_date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                      </span>
                      <span className="closing-shift">{purchase.shop_name}</span>
                    </div>
                    <div className="closing-total">
                      <span className="total-label">Cantidad:</span>
                      <span className="total-value">
                        {formatNumber(purchase.quantity)} {purchase.unit_of_measure}
                      </span>
                    </div>
                    {expandedId === purchase.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>

                  {expandedId === purchase.id && (
                    <div className="closing-body">
                      <div className="closing-details">
                        <div className="detail-group">
                          <h5>Información</h5>
                          <div className="detail-row">
                            <span>Producto:</span>
                            <span>{purchase.product?.name || 'N/A'}</span>
                          </div>
                          <div className="detail-row">
                            <span>Fecha:</span>
                            <span>{format(new Date(purchase.purchase_date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</span>
                          </div>
                          <div className="detail-row">
                            <span>Cantidad:</span>
                            <span>{formatNumber(purchase.quantity)} {purchase.unit_of_measure}</span>
                          </div>
                          {purchase.unit_price && (
                            <div className="detail-row">
                              <span>Precio unitario:</span>
                              <span>${formatNumber(purchase.unit_price)}</span>
                            </div>
                          )}
                          {purchase.total_amount && (
                            <div className="detail-row">
                              <span>Total:</span>
                              <span>${formatNumber(purchase.total_amount)}</span>
                            </div>
                          )}
                          {purchase.supplier_name && (
                            <div className="detail-row">
                              <span>Proveedor:</span>
                              <span>{purchase.supplier_name}</span>
                            </div>
                          )}
                          {purchase.invoice_number && (
                            <div className="detail-row">
                              <span>Factura:</span>
                              <span>{purchase.invoice_number}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {purchase.notes && (
                        <div className="closing-notes">
                          <strong>Notas:</strong> {purchase.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Stock Tab */}
      {activeTab === 'stock' && (
        <>
          <div className="section-actions">
            <select
              value={stockShop}
              onChange={(e) => {
                setStockShop(e.target.value)
                fetchStockSnapshots()
              }}
              className="shop-selector"
            >
              {shopOptions.map(shop => (
                <option key={shop} value={shop}>{shop}</option>
              ))}
            </select>
            <button 
              className="btn-primary"
              onClick={() => setShowStockForm(!showStockForm)}
            >
              <Plus size={18} />
              Nueva existencia
            </button>
          </div>

          {showStockForm && (
            <div className="closing-form-card">
              <div className="form-header">
                <h3>Nueva existencia</h3>
                <button 
                  className="icon-button"
                  onClick={() => {
                    setShowStockForm(false)
                    setError(null)
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateStockSnapshot}>
                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Producto *</label>
                    <select 
                      value={stockProductId || ''} 
                      onChange={(e) => {
                        const productId = parseInt(e.target.value)
                        setStockProductId(productId)
                        const product = products.find(p => p.id === productId)
                        if (product) {
                          setStockUnit(product.unit_of_measure)
                        }
                      }}
                      required
                    >
                      <option value="">Seleccionar producto...</option>
                      {products
                        .filter(p => p.shop_name === stockShop)
                        .map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.unit_of_measure})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Local *</label>
                    <select 
                      value={stockShop} 
                      onChange={(e) => {
                        setStockShop(e.target.value)
                        fetchProducts()
                      }}
                      required
                    >
                      {shopOptions.map(shop => (
                        <option key={shop} value={shop}>{shop}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row three-cols">
                  <div className="form-group">
                    <label>Fecha *</label>
                    <input
                      type="date"
                      value={stockDate}
                      onChange={(e) => setStockDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Cantidad *</label>
                    <input
                      type="number"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unidad</label>
                    <input
                      type="text"
                      value={stockUnit}
                      readOnly
                      disabled
                      style={{ opacity: 0.6 }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={isInitialStock}
                      onChange={(e) => setIsInitialStock(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    Marcar como stock inicial del período
                  </label>
                  <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
                    El stock inicial se usa para calcular la utilización
                  </small>
                </div>
                <div className="form-group">
                  <label>Notas (opcional)</label>
                  <textarea
                    value={stockNotes}
                    onChange={(e) => setStockNotes(e.target.value)}
                    placeholder="Observaciones sobre esta existencia..."
                    rows={2}
                  />
                </div>
                {error && <div className="form-error">{error}</div>}
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={() => {
                      setShowStockForm(false)
                      setError(null)
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
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
                        Guardar existencia
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="closings-list">
            {stockSnapshots.length === 0 ? (
              <div className="empty-state">
                <ClipboardList size={48} />
                <h3>Sin existencias</h3>
                <p>Todavia no cargaste ninguna existencia en este local</p>
              </div>
            ) : (
              stockSnapshots.map(snapshot => (
                <div 
                  key={snapshot.id} 
                  className={`closing-card ${expandedId === snapshot.id ? 'expanded' : ''}`}
                >
                  <button 
                    className="closing-header"
                    onClick={() => setExpandedId(expandedId === snapshot.id ? null : snapshot.id)}
                  >
                    <div className="closing-info">
                      <span className="closing-shop">
                        {snapshot.product?.name || 'Producto eliminado'}
                      </span>
                      <span className="closing-date">
                        {format(new Date(snapshot.snapshot_date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                      </span>
                      <span className="closing-shift">{snapshot.shop_name}</span>
                      {snapshot.is_initial_stock && (
                        <span className="closing-shift" style={{ color: '#10b981', fontWeight: 'bold' }}>
                          Stock inicial
                        </span>
                      )}
                    </div>
                    <div className="closing-total">
                      <span className="total-label">Cantidad:</span>
                      <span className="total-value">
                        {formatNumber(snapshot.quantity)} {snapshot.unit_of_measure}
                      </span>
                    </div>
                    {expandedId === snapshot.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>

                  {expandedId === snapshot.id && (
                    <div className="closing-body">
                      <div className="closing-details">
                        <div className="detail-group">
                          <h5>Información</h5>
                          <div className="detail-row">
                            <span>Producto:</span>
                            <span>{snapshot.product?.name || 'N/A'}</span>
                          </div>
                          <div className="detail-row">
                            <span>Fecha:</span>
                            <span>{format(new Date(snapshot.snapshot_date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</span>
                          </div>
                          <div className="detail-row">
                            <span>Cantidad:</span>
                            <span>{formatNumber(snapshot.quantity)} {snapshot.unit_of_measure}</span>
                          </div>
                          <div className="detail-row">
                            <span>Es stock inicial:</span>
                            <span>{snapshot.is_initial_stock ? 'Sí' : 'No'}</span>
                          </div>
                        </div>
                      </div>
                      {snapshot.notes && (
                        <div className="closing-notes">
                          <strong>Notas:</strong> {snapshot.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
