import { useState, useEffect } from 'react'
import { 
  DollarSign, Loader2, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown,
  Filter, RefreshCw, Edit3, Save, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CashClosing, ClosingStatus } from '../../types/database'
import { SHOP_LIST, SHIFT_LABELS, CLOSING_STATUS_LABELS } from '../../types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface AdminCashClosingsPanelProps {
  orders: Array<{ shopName: string; total: number; orderDate: string; paymentmethod: string }>
  fromDate: string
  toDate: string
}

interface ClosingWithUser extends Omit<CashClosing, 'user'> {
  user?: {
    email: string
    full_name: string | null
  }
}

interface EditForm {
  cash_sales: string
  card_sales: string
  mercadopago_sales: string
  rappi_sales: string
  pedidosya_sales: string
  mp_delivery_sales: string
  other_sales: string
  admin_notes: string
}

export function AdminCashClosingsPanel({ orders, fromDate, toDate }: AdminCashClosingsPanelProps) {
  const [closings, setClosings] = useState<ClosingWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterShop, setFilterShop] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [updating, setUpdating] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    cash_sales: '',
    card_sales: '',
    mercadopago_sales: '',
    rappi_sales: '',
    pedidosya_sales: '',
    mp_delivery_sales: '',
    other_sales: '',
    admin_notes: ''
  })

  useEffect(() => {
    fetchClosings()
  }, [fromDate, toDate])

  const fetchClosings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('cash_closings')
        .select(`
          *,
          user:user_profiles!cash_closings_user_id_fkey(email, full_name)
        `)
        .gte('closing_date', fromDate)
        .lte('closing_date', toDate)
        .order('closing_date', { ascending: false })

      if (error) throw error
      
      const closingsWithComparison = (data || []).map((closing: any) => {
        const apiData = calculateApiDataForClosing(closing)
        return {
          ...closing,
          api_total: apiData.total,
          api_cash: apiData.cash,
          api_card: apiData.card,
          variance: closing.total_declared - apiData.total,
          variance_percentage: apiData.total > 0 
            ? ((closing.total_declared - apiData.total) / apiData.total) * 100 
            : 0
        } as ClosingWithUser
      })
      
      setClosings(closingsWithComparison)
    } catch (err) {
      console.error('Error fetching closings:', err)
    } finally {
      setLoading(false)
    }
  }

  const calculateApiDataForClosing = (closing: CashClosing) => {
    const closingOrders = orders.filter(o => {
      const orderDate = o.orderDate.split('T')[0]
      return o.shopName === closing.shop_name && orderDate === closing.closing_date
    })

    const total = closingOrders.reduce((sum, o) => sum + o.total, 0)
    const cash = closingOrders
      .filter(o => o.paymentmethod?.toLowerCase().includes('efectivo') || o.paymentmethod?.toLowerCase().includes('cash'))
      .reduce((sum, o) => sum + o.total, 0)
    const card = closingOrders
      .filter(o => o.paymentmethod?.toLowerCase().includes('tarjeta') || o.paymentmethod?.toLowerCase().includes('card'))
      .reduce((sum, o) => sum + o.total, 0)

    return { total, cash, card }
  }

  const startEditing = (closing: ClosingWithUser) => {
    setEditingId(closing.id)
    setEditForm({
      cash_sales: closing.cash_sales.toString(),
      card_sales: closing.card_sales.toString(),
      mercadopago_sales: closing.mercadopago_sales.toString(),
      rappi_sales: closing.rappi_sales.toString(),
      pedidosya_sales: closing.pedidosya_sales.toString(),
      mp_delivery_sales: closing.mp_delivery_sales.toString(),
      other_sales: closing.other_sales.toString(),
      admin_notes: closing.admin_notes || ''
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditForm({
      cash_sales: '',
      card_sales: '',
      mercadopago_sales: '',
      rappi_sales: '',
      pedidosya_sales: '',
      mp_delivery_sales: '',
      other_sales: '',
      admin_notes: ''
    })
  }

  const saveEditing = async (closingId: number) => {
    setUpdating(closingId)
    try {
      const cashNum = parseFloat(editForm.cash_sales) || 0
      const cardNum = parseFloat(editForm.card_sales) || 0
      const mpNum = parseFloat(editForm.mercadopago_sales) || 0
      const rappiNum = parseFloat(editForm.rappi_sales) || 0
      const pyNum = parseFloat(editForm.pedidosya_sales) || 0
      const mpDelNum = parseFloat(editForm.mp_delivery_sales) || 0
      const otherNum = parseFloat(editForm.other_sales) || 0
      const totalDeclared = cashNum + cardNum + mpNum + rappiNum + pyNum + mpDelNum + otherNum

      const { error } = await supabase
        .from('cash_closings')
        .update({
          cash_sales: cashNum,
          card_sales: cardNum,
          mercadopago_sales: mpNum,
          rappi_sales: rappiNum,
          pedidosya_sales: pyNum,
          mp_delivery_sales: mpDelNum,
          other_sales: otherNum,
          total_declared: totalDeclared,
          admin_notes: editForm.admin_notes || null,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        } as any as never)
        .eq('id', closingId)

      if (error) throw error
      
      setEditingId(null)
      fetchClosings()
    } catch (err) {
      console.error('Error saving closing:', err)
      alert('Error al guardar los cambios')
    } finally {
      setUpdating(null)
    }
  }

  const updateClosingStatus = async (closingId: number, newStatus: ClosingStatus, adminNotes?: string) => {
    setUpdating(closingId)
    try {
      const { error } = await supabase
        .from('cash_closings')
        .update({ 
          status: newStatus,
          admin_notes: adminNotes || null,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        } as any as never)
        .eq('id', closingId)

      if (error) throw error
      fetchClosings()
    } catch (err) {
      console.error('Error updating closing:', err)
    } finally {
      setUpdating(null)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value)
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
      case 'rejected': return <XCircle size={16} />
      default: return <Clock size={16} />
    }
  }

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return 'var(--text-muted)'
    if (Math.abs(variance) < 100) return 'var(--success)'
    if (variance > 0) return '#f59e0b'
    return 'var(--danger)'
  }

  const filteredClosings = closings.filter(c => {
    if (filterShop && c.shop_name !== filterShop) return false
    if (filterStatus && c.status !== filterStatus) return false
    return true
  })

  const pendingCount = closings.filter(c => c.status === 'pending').length
  const withVarianceCount = closings.filter(c => Math.abs(c.variance || 0) > 500).length

  // Calcular total del formulario de edición
  const editFormTotal = editingId ? (
    (parseFloat(editForm.cash_sales) || 0) +
    (parseFloat(editForm.card_sales) || 0) +
    (parseFloat(editForm.mercadopago_sales) || 0) +
    (parseFloat(editForm.rappi_sales) || 0) +
    (parseFloat(editForm.pedidosya_sales) || 0) +
    (parseFloat(editForm.mp_delivery_sales) || 0) +
    (parseFloat(editForm.other_sales) || 0)
  ) : 0

  if (loading) {
    return (
      <div className="admin-panel-loading">
        <Loader2 size={32} className="spinning" />
        <p>Cargando cierres de caja...</p>
      </div>
    )
  }

  return (
    <div className="admin-closings-panel">
      <div className="panel-header">
        <div className="panel-title">
          <DollarSign size={24} />
          <div>
            <h2>Cierres de Caja</h2>
            <p>
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''} · 
              {withVarianceCount} con diferencia significativa
            </p>
          </div>
        </div>
        <div className="panel-actions">
          <button className="btn-secondary" onClick={fetchClosings}>
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="panel-filters">
        <Filter size={16} />
        <select 
          value={filterShop} 
          onChange={(e) => setFilterShop(e.target.value)}
          className="filter-select"
        >
          <option value="">Todas las tiendas</option>
          {SHOP_LIST.map(shop => (
            <option key={shop} value={shop}>{shop}</option>
          ))}
        </select>
        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="review">En revision</option>
          <option value="rejected">Rechazados</option>
        </select>
      </div>

      <div className="admin-closings-list">
        {filteredClosings.length === 0 ? (
          <div className="empty-state">
            <DollarSign size={48} />
            <h3>Sin cierres</h3>
            <p>No hay cierres de caja para este periodo</p>
          </div>
        ) : (
          filteredClosings.map(closing => (
            <div 
              key={closing.id} 
              className={`admin-closing-card ${expandedId === closing.id ? 'expanded' : ''} ${closing.status === 'pending' ? 'pending' : ''}`}
            >
              <button 
                className="closing-header"
                onClick={() => setExpandedId(expandedId === closing.id ? null : closing.id)}
              >
                <div className="closing-employee">
                  <div className="employee-avatar">
                    {(closing.user?.full_name || closing.user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="employee-info">
                    <span className="employee-name">{closing.user?.full_name || 'Sin nombre'}</span>
                    <span className="employee-email">{closing.user?.email}</span>
                  </div>
                </div>
                
                <div className="closing-info">
                  <span className="closing-shop">{closing.shop_name}</span>
                  <span className="closing-date">
                    {format(new Date(closing.closing_date + 'T12:00:00'), "EEE d MMM", { locale: es })}
                  </span>
                  <span className="closing-shift">{SHIFT_LABELS[closing.shift]}</span>
                </div>

                <div className="closing-comparison">
                  <div className="comparison-item">
                    <span className="comparison-label">Declarado</span>
                    <span className="comparison-value">{formatCurrency(closing.total_declared)}</span>
                  </div>
                  <div className="comparison-item">
                    <span className="comparison-label">API</span>
                    <span className="comparison-value">{formatCurrency(closing.api_total || 0)}</span>
                  </div>
                  <div className="comparison-item variance">
                    <span className="comparison-label">Diferencia</span>
                    <span 
                      className="comparison-value"
                      style={{ color: getVarianceColor(closing.variance) }}
                    >
                      {closing.variance && closing.variance > 0 ? '+' : ''}
                      {formatCurrency(closing.variance || 0)}
                      {closing.variance !== 0 && (
                        closing.variance && closing.variance > 0 
                          ? <TrendingUp size={14} /> 
                          : <TrendingDown size={14} />
                      )}
                    </span>
                  </div>
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
                  {editingId === closing.id ? (
                    // MODO EDICIÓN
                    <div className="edit-mode">
                      <h4>Editar montos</h4>
                      <div className="edit-grid">
                        <div className="edit-field">
                          <label>Efectivo</label>
                          <input
                            type="number"
                            value={editForm.cash_sales}
                            onChange={(e) => setEditForm({...editForm, cash_sales: e.target.value})}
                          />
                        </div>
                        <div className="edit-field">
                          <label>Tarjetas</label>
                          <input
                            type="number"
                            value={editForm.card_sales}
                            onChange={(e) => setEditForm({...editForm, card_sales: e.target.value})}
                          />
                        </div>
                        <div className="edit-field">
                          <label>Mercado Pago</label>
                          <input
                            type="number"
                            value={editForm.mercadopago_sales}
                            onChange={(e) => setEditForm({...editForm, mercadopago_sales: e.target.value})}
                          />
                        </div>
                        <div className="edit-field">
                          <label>Rappi</label>
                          <input
                            type="number"
                            value={editForm.rappi_sales}
                            onChange={(e) => setEditForm({...editForm, rappi_sales: e.target.value})}
                          />
                        </div>
                        <div className="edit-field">
                          <label>Pedidos Ya</label>
                          <input
                            type="number"
                            value={editForm.pedidosya_sales}
                            onChange={(e) => setEditForm({...editForm, pedidosya_sales: e.target.value})}
                          />
                        </div>
                        <div className="edit-field">
                          <label>MP Delivery</label>
                          <input
                            type="number"
                            value={editForm.mp_delivery_sales}
                            onChange={(e) => setEditForm({...editForm, mp_delivery_sales: e.target.value})}
                          />
                        </div>
                        <div className="edit-field">
                          <label>Otros</label>
                          <input
                            type="number"
                            value={editForm.other_sales}
                            onChange={(e) => setEditForm({...editForm, other_sales: e.target.value})}
                          />
                        </div>
                        <div className="edit-field total">
                          <label>TOTAL</label>
                          <span className="total-value">{formatCurrency(editFormTotal)}</span>
                        </div>
                      </div>
                      <div className="edit-field full-width">
                        <label>Notas del admin</label>
                        <textarea
                          value={editForm.admin_notes}
                          onChange={(e) => setEditForm({...editForm, admin_notes: e.target.value})}
                          placeholder="Motivo de la modificacion..."
                          rows={2}
                        />
                      </div>
                      <div className="edit-actions">
                        <button 
                          className="btn-secondary"
                          onClick={cancelEditing}
                          disabled={updating === closing.id}
                        >
                          <X size={16} />
                          Cancelar
                        </button>
                        <button 
                          className="btn-primary"
                          onClick={() => saveEditing(closing.id)}
                          disabled={updating === closing.id}
                        >
                          {updating === closing.id ? (
                            <Loader2 size={16} className="spinning" />
                          ) : (
                            <Save size={16} />
                          )}
                          Guardar cambios
                        </button>
                      </div>
                    </div>
                  ) : (
                    // MODO VISUALIZACIÓN
                    <>
                      <div className="closing-details-grid">
                        <div className="detail-card">
                          <h5>Declarado por empleado</h5>
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
                          <div className="detail-row total">
                            <span>TOTAL:</span>
                            <span>{formatCurrency(closing.total_declared)}</span>
                          </div>
                        </div>

                        <div className="detail-card">
                          <h5>Datos de API</h5>
                          <div className="detail-row">
                            <span>Total ventas:</span>
                            <span>{formatCurrency(closing.api_total || 0)}</span>
                          </div>
                          <div className="detail-row">
                            <span>Efectivo:</span>
                            <span>{formatCurrency(closing.api_cash || 0)}</span>
                          </div>
                          <div className="detail-row">
                            <span>Tarjeta:</span>
                            <span>{formatCurrency(closing.api_card || 0)}</span>
                          </div>
                          <div className={`detail-row variance ${(closing.variance || 0) < -100 ? 'negative' : (closing.variance || 0) > 100 ? 'warning' : 'positive'}`}>
                            <span>Variacion:</span>
                            <span>
                              {formatCurrency(closing.variance || 0)} 
                              ({closing.variance_percentage?.toFixed(1)}%)
                            </span>
                          </div>
                        </div>

                        <div className="detail-card">
                          <h5>Caja fisica</h5>
                          <div className="detail-row">
                            <span>Caja inicial:</span>
                            <span>{formatCurrency(closing.opening_cash)}</span>
                          </div>
                          <div className="detail-row">
                            <span>Caja final:</span>
                            <span>{formatCurrency(closing.closing_cash)}</span>
                          </div>
                          <div className={`detail-row ${closing.cash_difference < 0 ? 'negative' : closing.cash_difference > 0 ? 'positive' : ''}`}>
                            <span>Diferencia:</span>
                            <span>{formatCurrency(closing.cash_difference)}</span>
                          </div>
                        </div>
                      </div>

                      {closing.notes && (
                        <div className="closing-notes">
                          <strong>Notas del empleado:</strong> {closing.notes}
                        </div>
                      )}

                      {closing.admin_notes && (
                        <div className="admin-notes">
                          <strong>Notas del admin:</strong> {closing.admin_notes}
                        </div>
                      )}

                      <div className="closing-actions">
                        <button 
                          className="btn-edit"
                          onClick={() => startEditing(closing)}
                          disabled={updating === closing.id}
                        >
                          <Edit3 size={16} />
                          Modificar
                        </button>
                        
                        {closing.status === 'pending' && (
                          <>
                            <button 
                              className="btn-approve"
                              onClick={() => updateClosingStatus(closing.id, 'approved')}
                              disabled={updating === closing.id}
                            >
                              {updating === closing.id ? <Loader2 size={16} className="spinning" /> : <CheckCircle size={16} />}
                              Aprobar
                            </button>
                            <button 
                              className="btn-review"
                              onClick={() => updateClosingStatus(closing.id, 'review')}
                              disabled={updating === closing.id}
                            >
                              <AlertTriangle size={16} />
                              Revision
                            </button>
                            <button 
                              className="btn-reject"
                              onClick={() => {
                                const note = prompt('Motivo del rechazo:')
                                if (note) updateClosingStatus(closing.id, 'rejected', note)
                              }}
                              disabled={updating === closing.id}
                            >
                              <XCircle size={16} />
                              Rechazar
                            </button>
                          </>
                        )}

                        {closing.status !== 'pending' && closing.status !== 'approved' && (
                          <button 
                            className="btn-approve"
                            onClick={() => updateClosingStatus(closing.id, 'approved')}
                            disabled={updating === closing.id}
                          >
                            <CheckCircle size={16} />
                            Aprobar
                          </button>
                        )}
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
