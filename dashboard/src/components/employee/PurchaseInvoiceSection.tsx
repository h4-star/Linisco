import { useState, useEffect } from 'react'
import { 
  FileText, Save, Loader2, CheckCircle, AlertTriangle,
  ChevronDown, ChevronUp, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { PurchaseInvoice } from '../../types/database'
import { SHOP_LIST } from '../../types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface PurchaseInvoiceSectionProps {
  userId: string
  assignedShops: string[]
}

export function PurchaseInvoiceSection({ userId, assignedShops }: PurchaseInvoiceSectionProps) {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [supplierName, setSupplierName] = useState('')
  const [supplierCuit, setSupplierCuit] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [iva, setIva] = useState('')
  const [internalTaxes, setInternalTaxes] = useState('')
  const [shopName, setShopName] = useState(assignedShops[0] || '')
  const [notes, setNotes] = useState('')

  const shopOptions = assignedShops.length > 0 ? assignedShops : SHOP_LIST

  useEffect(() => {
    fetchInvoices()
  }, [userId])

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('*')
        .eq('user_id', userId)
        .order('invoice_date', { ascending: false })
        .limit(50)

      if (error) throw error
      setInvoices(data || [])
    } catch (err) {
      console.error('Error fetching invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calcular total
  const subtotalNum = parseFloat(subtotal) || 0
  const ivaNum = parseFloat(iva) || 0
  const internalTaxesNum = parseFloat(internalTaxes) || 0
  const calculatedTotal = subtotalNum + ivaNum + internalTaxesNum

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoiceNumber || !invoiceDate || !subtotal) {
      setError('El número de factura, fecha y subtotal son obligatorios')
      return
    }

    setSaving(true)
    setError(null)
    
    try {
      const insertData = {
        user_id: userId,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        supplier_name: supplierName.trim() || null,
        supplier_cuit: supplierCuit.trim() || null,
        subtotal: subtotalNum,
        iva: ivaNum > 0 ? ivaNum : null,
        internal_taxes: internalTaxesNum > 0 ? internalTaxesNum : null,
        shop_name: shopName || null,
        notes: notes.trim() || null,
      }
      
      const { error: insertError } = await supabase
        .from('purchase_invoices')
        .insert(insertData as any)
        .select()

      if (insertError) {
        console.error('Error de Supabase:', insertError)
        if (insertError.code === '23505') {
          setError('Ya existe una factura con este número y fecha')
        } else if (insertError.code === '42501') {
          setError('No tenes permiso para crear facturas. Contacta al administrador.')
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
      setShopName(assignedShops[0] || '')
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  if (loading) {
    return (
      <div className="section-loading">
        <Loader2 size={32} className="spinning" />
        <p>Cargando facturas...</p>
      </div>
    )
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="section-icon">
          <FileText size={24} />
        </div>
        <div>
          <h1>Facturas de Compra</h1>
          <p>Carga facturas de compra con sus impuestos</p>
        </div>
        <button 
          className="btn-primary header-action"
          onClick={() => setShowForm(!showForm)}
        >
          <FileText size={18} />
          Nueva factura
        </button>
      </div>

      {showForm && (
        <div className="closing-form-card">
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
          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <h4>Información de la Factura</h4>
              <div className="form-row three-cols">
                <div className="form-group">
                  <label>Número de factura *</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="0001-00001234"
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
                  <label>Local (opcional)</label>
                  <select 
                    value={shopName} 
                    onChange={(e) => setShopName(e.target.value)}
                  >
                    <option value="">Ninguno</option>
                    {shopOptions.map(shop => (
                      <option key={shop} value={shop}>{shop}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Proveedor (opcional)</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Nombre del proveedor"
                  />
                </div>
                <div className="form-group">
                  <label>CUIT (opcional)</label>
                  <input
                    type="text"
                    value={supplierCuit}
                    onChange={(e) => setSupplierCuit(e.target.value)}
                    placeholder="20-12345678-9"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>Montos</h4>
              <div className="form-row three-cols">
                <div className="form-group">
                  <label>Subtotal *</label>
                  <input
                    type="number"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>IVA (opcional)</label>
                  <input
                    type="number"
                    value={iva}
                    onChange={(e) => setIva(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Impuestos internos (opcional)</label>
                  <input
                    type="number"
                    value={internalTaxes}
                    onChange={(e) => setInternalTaxes(e.target.value)}
                    placeholder="0.00"
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
                placeholder="Observaciones adicionales..."
                rows={2}
              />
            </div>

            <div className="form-summary">
              <div className="summary-item">
                <span>Total calculado:</span>
                <strong>{formatCurrency(calculatedTotal)}</strong>
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
                onClick={() => {
                  setShowForm(false)
                  setError(null)
                }}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={saving || !invoiceNumber || !invoiceDate || !subtotal}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="spinning" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Guardar factura
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="closings-list">
        {invoices.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} />
            <h3>Sin facturas</h3>
            <p>Todavia no cargaste ninguna factura de compra</p>
          </div>
        ) : (
          invoices.map(invoice => (
            <div 
              key={invoice.id} 
              className={`closing-card ${expandedId === invoice.id ? 'expanded' : ''}`}
            >
              <button 
                className="closing-header"
                onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}
              >
                <div className="closing-info">
                  <span className="closing-shop">
                    {invoice.supplier_name || 'Sin proveedor'}
                  </span>
                  <span className="closing-date">
                    {format(new Date(invoice.invoice_date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                  </span>
                  <span className="closing-shift">Factura #{invoice.invoice_number}</span>
                  {invoice.shop_name && (
                    <span className="closing-shift">{invoice.shop_name}</span>
                  )}
                </div>
                <div className="closing-total">
                  <span className="total-label">Total:</span>
                  <span className="total-value">{formatCurrency(invoice.total)}</span>
                </div>
                {expandedId === invoice.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {expandedId === invoice.id && (
                <div className="closing-body">
                  <div className="closing-details">
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
                    <div className="closing-notes">
                      <strong>Notas:</strong> {invoice.notes}
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
