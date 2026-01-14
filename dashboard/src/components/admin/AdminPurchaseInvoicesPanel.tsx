import { useState, useEffect } from 'react'
import { 
  FileText, Loader2, ChevronDown, ChevronUp,
  Filter, RefreshCw, Edit3, Save, X, Plus
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { PurchaseInvoice } from '../../types/database'
import { SHOP_LIST } from '../../types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface InvoiceWithUser extends Omit<PurchaseInvoice, 'user'> {
  user?: {
    email: string
    full_name: string | null
  }
}

interface EditForm {
  invoice_number: string
  invoice_date: string
  supplier_name: string
  supplier_cuit: string
  subtotal: string
  iva: string
  internal_taxes: string
  shop_name: string
  notes: string
}

export function AdminPurchaseInvoicesPanel() {
  const [invoices, setInvoices] = useState<InvoiceWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterShop, setFilterShop] = useState<string>('')
  const [filterSupplier, setFilterSupplier] = useState<string>('')
  const [updating, setUpdating] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state (para crear nueva)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [supplierName, setSupplierName] = useState('')
  const [supplierCuit, setSupplierCuit] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [iva, setIva] = useState('')
  const [internalTaxes, setInternalTaxes] = useState('')
  const [shopName, setShopName] = useState('')
  const [notes, setNotes] = useState('')

  // Edit form state
  const [editForm, setEditForm] = useState<EditForm>({
    invoice_number: '',
    invoice_date: '',
    supplier_name: '',
    supplier_cuit: '',
    subtotal: '',
    iva: '',
    internal_taxes: '',
    shop_name: '',
    notes: ''
  })

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select(`
          *,
          user:user_profiles!purchase_invoices_user_id_fkey(email, full_name)
        `)
        .order('invoice_date', { ascending: false })
        .limit(200)

      if (error) throw error
      setInvoices(data || [])
    } catch (err) {
      console.error('Error fetching invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoiceNumber || !invoiceDate || !subtotal) {
      setError('El número de factura, fecha y subtotal son obligatorios')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      const insertData = {
        user_id: user.id,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        supplier_name: supplierName.trim() || null,
        supplier_cuit: supplierCuit.trim() || null,
        subtotal: parseFloat(subtotal) || 0,
        iva: parseFloat(iva) > 0 ? parseFloat(iva) : null,
        internal_taxes: parseFloat(internalTaxes) > 0 ? parseFloat(internalTaxes) : null,
        shop_name: shopName || null,
        notes: notes.trim() || null,
      }

      const { error: insertError } = await supabase
        .from('purchase_invoices')
        .insert(insertData as any)
        .select()

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Ya existe una factura con este número y fecha')
        } else {
          setError(`Error: ${insertError.message}`)
        }
        return
      }

      // Reset form
      setInvoiceNumber('')
      setInvoiceDate(format(new Date(), 'yyyy-MM-dd'))
      setSupplierName('')
      setSupplierCuit('')
      setSubtotal('')
      setIva('')
      setInternalTaxes('')
      setShopName('')
      setNotes('')
      setShowForm(false)
      setError(null)
      fetchInvoices()
    } catch (err: any) {
      console.error('Error guardando factura:', err)
      setError(`Error inesperado: ${err.message || 'Intenta de nuevo'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (invoice: InvoiceWithUser) => {
    setEditingId(invoice.id)
    setEditForm({
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      supplier_name: invoice.supplier_name || '',
      supplier_cuit: invoice.supplier_cuit || '',
      subtotal: invoice.subtotal.toString(),
      iva: invoice.iva?.toString() || '',
      internal_taxes: invoice.internal_taxes?.toString() || '',
      shop_name: invoice.shop_name || '',
      notes: invoice.notes || ''
    })
  }

  const handleSaveEdit = async (id: number) => {
    setUpdating(id)
    try {
      const updateData: any = {
        invoice_number: editForm.invoice_number.trim(),
        invoice_date: editForm.invoice_date,
        supplier_name: editForm.supplier_name.trim() || null,
        supplier_cuit: editForm.supplier_cuit.trim() || null,
        subtotal: parseFloat(editForm.subtotal) || 0,
        iva: parseFloat(editForm.iva) > 0 ? parseFloat(editForm.iva) : null,
        internal_taxes: parseFloat(editForm.internal_taxes) > 0 ? parseFloat(editForm.internal_taxes) : null,
        shop_name: editForm.shop_name || null,
        notes: editForm.notes.trim() || null,
      }

      const { error } = await supabase
        .from('purchase_invoices')
        .update(updateData)
        .eq('id', id)

      if (error) throw error
      setEditingId(null)
      fetchInvoices()
    } catch (err) {
      console.error('Error updating invoice:', err)
    } finally {
      setUpdating(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta factura?')) return
    
    setUpdating(id)
    try {
      const { error } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchInvoices()
    } catch (err) {
      console.error('Error deleting invoice:', err)
      alert('Error al eliminar la factura')
    } finally {
      setUpdating(null)
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

  const filteredInvoices = invoices.filter(inv => {
    if (filterShop && inv.shop_name !== filterShop) return false
    if (filterSupplier && inv.supplier_name && !inv.supplier_name.toLowerCase().includes(filterSupplier.toLowerCase())) return false
    return true
  })

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0)
  const totalSubtotal = filteredInvoices.reduce((sum, inv) => sum + inv.subtotal, 0)
  const totalIva = filteredInvoices.reduce((sum, inv) => sum + (inv.iva || 0), 0)
  const totalInternalTaxes = filteredInvoices.reduce((sum, inv) => sum + (inv.internal_taxes || 0), 0)

  if (loading) {
    return (
      <div className="admin-panel-loading">
        <Loader2 size={32} className="spinning" />
        <p>Cargando facturas...</p>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h1>Facturas de Compra</h1>
          <p>Gestión de facturas de compra cargadas</p>
        </div>
        <div className="admin-panel-actions">
          <button 
            className="btn-secondary"
            onClick={fetchInvoices}
            disabled={loading}
          >
            <RefreshCw size={18} />
            Actualizar
          </button>
          <button 
            className="btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus size={18} />
            Nueva factura
          </button>
        </div>
      </div>

      {showForm && (
        <div className="admin-form-card">
          <div className="form-header">
            <h3>Nueva factura de compra</h3>
            <button 
              className="icon-button"
              onClick={() => {
                setShowForm(false)
                setError(null)
              }}
            >
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleCreate}>
            <div className="form-row three-cols">
              <div className="form-group">
                <label>Número de factura *</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Fecha *</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Local</label>
                <select 
                  value={shopName} 
                  onChange={(e) => setShopName(e.target.value)}
                >
                  <option value="">Ninguno</option>
                  {SHOP_LIST.map(shop => (
                    <option key={shop} value={shop}>{shop}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row two-cols">
              <div className="form-group">
                <label>Proveedor</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>CUIT</label>
                <input
                  type="text"
                  value={supplierCuit}
                  onChange={(e) => setSupplierCuit(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row three-cols">
              <div className="form-group">
                <label>Subtotal *</label>
                <input
                  type="number"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="form-group">
                <label>IVA</label>
                <input
                  type="number"
                  value={iva}
                  onChange={(e) => setIva(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Impuestos internos</label>
                <input
                  type="number"
                  value={internalTaxes}
                  onChange={(e) => setInternalTaxes(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            {error && <div className="form-error">{error}</div>}
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
                    Guardar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

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
          <input
            type="text"
            placeholder="Buscar por proveedor..."
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            style={{ minWidth: '200px' }}
          />
        </div>
      </div>

      <div className="admin-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total facturas</span>
          <span className="stat-value">{filteredInvoices.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total general</span>
          <span className="stat-value">{formatCurrency(totalAmount)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Subtotal</span>
          <span className="stat-value">{formatCurrency(totalSubtotal)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">IVA total</span>
          <span className="stat-value">{formatCurrency(totalIva)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Imp. internos</span>
          <span className="stat-value">{formatCurrency(totalInternalTaxes)}</span>
        </div>
      </div>

      <div className="admin-list">
        {filteredInvoices.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <h3>Sin facturas</h3>
            <p>No hay facturas que coincidan con los filtros</p>
          </div>
        ) : (
          filteredInvoices.map(invoice => (
            <div 
              key={invoice.id} 
              className={`admin-card ${expandedId === invoice.id ? 'expanded' : ''}`}
            >
              <button 
                className="admin-card-header"
                onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}
              >
                <div className="admin-card-info">
                  <span className="card-title">
                    {invoice.supplier_name || 'Sin proveedor'}
                  </span>
                  <span className="card-subtitle">
                    Factura #{invoice.invoice_number} - {format(new Date(invoice.invoice_date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}
                  </span>
                  {invoice.shop_name && (
                    <span className="card-badge">{invoice.shop_name}</span>
                  )}
                  {invoice.user && (
                    <span className="card-badge">Por: {invoice.user.full_name || invoice.user.email}</span>
                  )}
                </div>
                <div className="admin-card-total">
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
                {expandedId === invoice.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {expandedId === invoice.id && (
                <div className="admin-card-body">
                  {editingId === invoice.id ? (
                    <div className="edit-form">
                      <div className="form-row three-cols">
                        <div className="form-group">
                          <label>Número</label>
                          <input
                            type="text"
                            value={editForm.invoice_number}
                            onChange={(e) => setEditForm({ ...editForm, invoice_number: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Fecha</label>
                          <input
                            type="date"
                            value={editForm.invoice_date}
                            onChange={(e) => setEditForm({ ...editForm, invoice_date: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Local</label>
                          <select 
                            value={editForm.shop_name} 
                            onChange={(e) => setEditForm({ ...editForm, shop_name: e.target.value })}
                          >
                            <option value="">Ninguno</option>
                            {SHOP_LIST.map(shop => (
                              <option key={shop} value={shop}>{shop}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="form-row two-cols">
                        <div className="form-group">
                          <label>Proveedor</label>
                          <input
                            type="text"
                            value={editForm.supplier_name}
                            onChange={(e) => setEditForm({ ...editForm, supplier_name: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>CUIT</label>
                          <input
                            type="text"
                            value={editForm.supplier_cuit}
                            onChange={(e) => setEditForm({ ...editForm, supplier_cuit: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="form-row three-cols">
                        <div className="form-group">
                          <label>Subtotal</label>
                          <input
                            type="number"
                            value={editForm.subtotal}
                            onChange={(e) => setEditForm({ ...editForm, subtotal: e.target.value })}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="form-group">
                          <label>IVA</label>
                          <input
                            type="number"
                            value={editForm.iva}
                            onChange={(e) => setEditForm({ ...editForm, iva: e.target.value })}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="form-group">
                          <label>Impuestos internos</label>
                          <input
                            type="number"
                            value={editForm.internal_taxes}
                            onChange={(e) => setEditForm({ ...editForm, internal_taxes: e.target.value })}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Notas</label>
                        <textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="form-actions">
                        <button 
                          className="btn-secondary"
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </button>
                        <button 
                          className="btn-primary"
                          onClick={() => handleSaveEdit(invoice.id)}
                          disabled={updating === invoice.id}
                        >
                          {updating === invoice.id ? (
                            <>
                              <Loader2 size={18} className="spinning" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Save size={18} />
                              Guardar
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
                            <span>Número:</span>
                            <span>{invoice.invoice_number}</span>
                          </div>
                          <div className="detail-row">
                            <span>Fecha:</span>
                            <span>{format(new Date(invoice.invoice_date + 'T12:00:00'), "d 'de' MMMM, yyyy", { locale: es })}</span>
                          </div>
                          {invoice.supplier_name && (
                            <div className="detail-row">
                              <span>Proveedor:</span>
                              <span>{invoice.supplier_name}</span>
                            </div>
                          )}
                          {invoice.supplier_cuit && (
                            <div className="detail-row">
                              <span>CUIT:</span>
                              <span>{invoice.supplier_cuit}</span>
                            </div>
                          )}
                          {invoice.shop_name && (
                            <div className="detail-row">
                              <span>Local:</span>
                              <span>{invoice.shop_name}</span>
                            </div>
                          )}
                          {invoice.user && (
                            <div className="detail-row">
                              <span>Cargado por:</span>
                              <span>{invoice.user.full_name || invoice.user.email}</span>
                            </div>
                          )}
                        </div>
                        <div className="detail-group">
                          <h5>Montos</h5>
                          <div className="detail-row">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(invoice.subtotal)}</span>
                          </div>
                          {invoice.iva !== null && invoice.iva > 0 && (
                            <div className="detail-row">
                              <span>IVA:</span>
                              <span>{formatCurrency(invoice.iva)}</span>
                            </div>
                          )}
                          {invoice.internal_taxes !== null && invoice.internal_taxes > 0 && (
                            <div className="detail-row">
                              <span>Impuestos internos:</span>
                              <span>{formatCurrency(invoice.internal_taxes)}</span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span><strong>Total:</strong></span>
                            <span><strong>{formatCurrency(invoice.total)}</strong></span>
                          </div>
                        </div>
                      </div>
                      {invoice.notes && (
                        <div className="admin-card-notes">
                          <strong>Notas:</strong> {invoice.notes}
                        </div>
                      )}
                      <div className="admin-card-actions">
                        <button 
                          className="btn-secondary"
                          onClick={() => handleEdit(invoice)}
                        >
                          <Edit3 size={16} />
                          Editar
                        </button>
                        <button 
                          className="btn-danger"
                          onClick={() => handleDelete(invoice.id)}
                          disabled={updating === invoice.id}
                        >
                          {updating === invoice.id ? (
                            <Loader2 size={16} className="spinning" />
                          ) : (
                            <X size={16} />
                          )}
                          Eliminar
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
