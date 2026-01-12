import { useState, useEffect } from 'react'
import { 
  DollarSign, Save, Loader2, CheckCircle, AlertTriangle,
  ChevronDown, ChevronUp, Clock
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CashClosing, ShiftType, ClosingStatus } from '../../types/database'
import { SHOP_LIST, SHIFT_LABELS, CLOSING_STATUS_LABELS } from '../../types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface CashClosingSectionProps {
  userId: string
  assignedShops: string[]
}

export function CashClosingSection({ userId, assignedShops }: CashClosingSectionProps) {
  const [closings, setClosings] = useState<CashClosing[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [shopName, setShopName] = useState(assignedShops[0] || '')
  const [closingDate, setClosingDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [shift, setShift] = useState<ShiftType>('full')
  
  // Métodos de pago
  const [cashSales, setCashSales] = useState('')
  const [cardSales, setCardSales] = useState('')
  const [mercadopagoSales, setMercadopagoSales] = useState('')
  const [rappiSales, setRappiSales] = useState('')
  const [pedidosyaSales, setPedidosyaSales] = useState('')
  const [mpDeliverySales, setMpDeliverySales] = useState('')
  const [otherSales, setOtherSales] = useState('')
  
  // Caja física
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [notes, setNotes] = useState('')

  const shopOptions = assignedShops.length > 0 ? assignedShops : SHOP_LIST

  useEffect(() => {
    fetchClosings()
  }, [userId])

  const fetchClosings = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_closings')
        .select('*')
        .eq('user_id', userId)
        .order('closing_date', { ascending: false })
        .limit(50)

      if (error) throw error
      setClosings(data || [])
    } catch (err) {
      console.error('Error fetching closings:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calcular totales
  const cashNum = parseFloat(cashSales) || 0
  const cardNum = parseFloat(cardSales) || 0
  const mpNum = parseFloat(mercadopagoSales) || 0
  const rappiNum = parseFloat(rappiSales) || 0
  const pyNum = parseFloat(pedidosyaSales) || 0
  const mpDelNum = parseFloat(mpDeliverySales) || 0
  const otherNum = parseFloat(otherSales) || 0
  const openingNum = parseFloat(openingCash) || 0
  const closingNum = parseFloat(closingCash) || 0
  
  const totalDeclared = cashNum + cardNum + mpNum + rappiNum + pyNum + mpDelNum + otherNum
  const cashDifference = closingNum - openingNum - cashNum

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shopName || !closingDate) return

    setSaving(true)
    setError(null)
    
    console.log('Guardando cierre...', { userId, shopName, closingDate, shift })
    
    try {
      const insertData = {
        user_id: userId,
        shop_name: shopName,
        closing_date: closingDate,
        shift,
        cash_sales: cashNum,
        card_sales: cardNum,
        mercadopago_sales: mpNum,
        rappi_sales: rappiNum,
        pedidosya_sales: pyNum,
        mp_delivery_sales: mpDelNum,
        other_sales: otherNum,
        total_declared: totalDeclared,
        opening_cash: openingNum,
        closing_cash: closingNum,
        cash_difference: cashDifference,
        notes: notes.trim() || null,
        status: 'pending',
      }
      
      console.log('Datos a insertar:', insertData)
      
      const { data, error: insertError } = await supabase
        .from('cash_closings')
        .insert(insertData as any)
        .select()

      console.log('Respuesta:', { data, error: insertError })

      if (insertError) {
        console.error('Error de Supabase:', insertError)
        if (insertError.code === '23505') {
          setError('Ya existe un cierre para esta fecha, tienda y turno')
        } else if (insertError.code === '42501') {
          setError('No tenes permiso para crear cierres. Contacta al administrador.')
        } else {
          setError(`Error: ${insertError.message}`)
        }
        return
      }

      // Reset form
      setCashSales('')
      setCardSales('')
      setMercadopagoSales('')
      setRappiSales('')
      setPedidosyaSales('')
      setMpDeliverySales('')
      setOtherSales('')
      setOpeningCash('')
      setClosingCash('')
      setNotes('')
      setShowForm(false)
      setError(null)
      fetchClosings()
    } catch (err: any) {
      console.error('Error guardando cierre:', err)
      setError(`Error inesperado: ${err.message || 'Intenta de nuevo'}`)
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (status: ClosingStatus) => {
    switch (status) {
      case 'approved': return '#10b981'
      case 'review': return '#f59e0b'
      case 'rejected': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = (status: ClosingStatus) => {
    switch (status) {
      case 'approved': return <CheckCircle size={16} />
      case 'review': return <AlertTriangle size={16} />
      case 'rejected': return <AlertTriangle size={16} />
      default: return <Clock size={16} />
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)
  }

  if (loading) {
    return (
      <div className="section-loading">
        <Loader2 size={32} className="spinning" />
        <p>Cargando cierres...</p>
      </div>
    )
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="section-icon">
          <DollarSign size={24} />
        </div>
        <div>
          <h1>Cierre de Caja</h1>
          <p>Reporta los cierres de tu turno</p>
        </div>
        <button 
          className="btn-primary header-action"
          onClick={() => setShowForm(!showForm)}
        >
          <DollarSign size={18} />
          Nuevo cierre
        </button>
      </div>

      {showForm && (
        <div className="closing-form-card">
          <h3>Nuevo cierre de caja</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row three-cols">
              <div className="form-group">
                <label>Tienda</label>
                <select 
                  value={shopName} 
                  onChange={(e) => setShopName(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {shopOptions.map(shop => (
                    <option key={shop} value={shop}>{shop}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Turno</label>
                <select 
                  value={shift} 
                  onChange={(e) => setShift(e.target.value as ShiftType)}
                >
                  {Object.entries(SHIFT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-section">
              <h4>Metodos de Pago</h4>
              <div className="form-row three-cols">
                <div className="form-group">
                  <label>Efectivo</label>
                  <input
                    type="number"
                    value={cashSales}
                    onChange={(e) => setCashSales(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Tarjetas</label>
                  <input
                    type="number"
                    value={cardSales}
                    onChange={(e) => setCardSales(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Mercado Pago</label>
                  <input
                    type="number"
                    value={mercadopagoSales}
                    onChange={(e) => setMercadopagoSales(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="form-row three-cols">
                <div className="form-group">
                  <label>Rappi</label>
                  <input
                    type="number"
                    value={rappiSales}
                    onChange={(e) => setRappiSales(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Pedidos Ya</label>
                  <input
                    type="number"
                    value={pedidosyaSales}
                    onChange={(e) => setPedidosyaSales(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>MP Delivery</label>
                  <input
                    type="number"
                    value={mpDeliverySales}
                    onChange={(e) => setMpDeliverySales(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="form-row three-cols">
                <div className="form-group">
                  <label>Otros</label>
                  <input
                    type="number"
                    value={otherSales}
                    onChange={(e) => setOtherSales(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group"></div>
                <div className="form-group"></div>
              </div>
            </div>

            <div className="form-section">
              <h4>Caja Fisica</h4>
              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Caja inicial</label>
                  <input
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Caja final</label>
                  <input
                    type="number"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Alguna observacion sobre el cierre..."
                rows={2}
              />
            </div>

            <div className="form-summary">
              <div className="summary-item">
                <span>Total declarado:</span>
                <strong>{formatCurrency(totalDeclared)}</strong>
              </div>
              <div className="summary-item">
                <span>Diferencia caja:</span>
                <strong className={cashDifference < 0 ? 'negative' : ''}>
                  {formatCurrency(cashDifference)}
                </strong>
              </div>
            </div>

            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            <div className="form-actions">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={saving || !shopName}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="spinning" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Guardar cierre
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="closings-list">
        {closings.length === 0 ? (
          <div className="empty-state">
            <DollarSign size={48} />
            <h3>Sin cierres</h3>
            <p>Todavia no cargaste ningun cierre de caja</p>
          </div>
        ) : (
          closings.map(closing => (
            <div 
              key={closing.id} 
              className={`closing-card ${expandedId === closing.id ? 'expanded' : ''}`}
            >
              <button 
                className="closing-header"
                onClick={() => setExpandedId(expandedId === closing.id ? null : closing.id)}
              >
                <div className="closing-info">
                  <span className="closing-shop">{closing.shop_name}</span>
                  <span className="closing-date">
                    {format(new Date(closing.closing_date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                  </span>
                  <span className="closing-shift">{SHIFT_LABELS[closing.shift]}</span>
                </div>
                <div className="closing-total">
                  <span className="total-label">Total:</span>
                  <span className="total-value">{formatCurrency(closing.total_declared)}</span>
                </div>
                <div 
                  className="closing-status"
                  style={{ color: getStatusColor(closing.status) }}
                >
                  {getStatusIcon(closing.status)}
                  <span>{CLOSING_STATUS_LABELS[closing.status]}</span>
                </div>
                {expandedId === closing.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {expandedId === closing.id && (
                <div className="closing-body">
                  <div className="closing-details">
                    <div className="detail-group">
                      <h5>Metodos de Pago</h5>
                      <div className="detail-row">
                        <span>Efectivo:</span>
                        <span>{formatCurrency(closing.cash_sales)}</span>
                      </div>
                      <div className="detail-row">
                        <span>Tarjetas:</span>
                        <span>{formatCurrency(closing.card_sales)}</span>
                      </div>
                      <div className="detail-row">
                        <span>Mercado Pago:</span>
                        <span>{formatCurrency(closing.mercadopago_sales)}</span>
                      </div>
                      <div className="detail-row">
                        <span>Rappi:</span>
                        <span>{formatCurrency(closing.rappi_sales)}</span>
                      </div>
                      <div className="detail-row">
                        <span>Pedidos Ya:</span>
                        <span>{formatCurrency(closing.pedidosya_sales)}</span>
                      </div>
                      <div className="detail-row">
                        <span>MP Delivery:</span>
                        <span>{formatCurrency(closing.mp_delivery_sales)}</span>
                      </div>
                      {closing.other_sales > 0 && (
                        <div className="detail-row">
                          <span>Otros:</span>
                          <span>{formatCurrency(closing.other_sales)}</span>
                        </div>
                      )}
                    </div>
                    <div className="detail-group">
                      <h5>Caja Fisica</h5>
                      <div className="detail-row">
                        <span>Inicial:</span>
                        <span>{formatCurrency(closing.opening_cash)}</span>
                      </div>
                      <div className="detail-row">
                        <span>Final:</span>
                        <span>{formatCurrency(closing.closing_cash)}</span>
                      </div>
                      <div className={`detail-row ${closing.cash_difference < 0 ? 'negative' : closing.cash_difference > 0 ? 'positive' : ''}`}>
                        <span>Diferencia:</span>
                        <span>{formatCurrency(closing.cash_difference)}</span>
                      </div>
                    </div>
                    {closing.api_total !== null && (
                      <div className="detail-group">
                        <h5>Comparacion API</h5>
                        <div className="detail-row">
                          <span>Total API:</span>
                          <span>{formatCurrency(closing.api_total)}</span>
                        </div>
                        <div className={`detail-row ${closing.variance && closing.variance < 0 ? 'negative' : ''}`}>
                          <span>Variacion:</span>
                          <span>{formatCurrency(closing.variance || 0)} ({closing.variance_percentage?.toFixed(1)}%)</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {closing.notes && (
                    <div className="closing-notes">
                      <strong>Notas:</strong> {closing.notes}
                    </div>
                  )}
                  {closing.admin_notes && (
                    <div className="admin-notes">
                      <strong>Notas del administrador:</strong> {closing.admin_notes}
                    </div>
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
