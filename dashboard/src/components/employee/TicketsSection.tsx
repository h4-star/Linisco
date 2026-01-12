import { useState, useEffect } from 'react'
import { 
  Wrench, Calendar, Package, HelpCircle, Plus, Loader2,
  ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Ticket, TicketType, TicketPriority, TicketStatus } from '../../types/database'
import { 
  SHOP_LIST, TICKET_TYPE_LABELS, TICKET_PRIORITY_LABELS, 
  TICKET_STATUS_LABELS 
} from '../../types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface TicketsSectionProps {
  userId: string
  assignedShops: string[]
}

const TICKET_TYPE_ICONS: Record<TicketType, typeof Wrench> = {
  repair: Wrench,
  vacation: Calendar,
  day_off: Calendar,
  supply: Package,
  other: HelpCircle,
}

export function TicketsSection({ userId, assignedShops }: TicketsSectionProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all')

  // Form state
  const [ticketType, setTicketType] = useState<TicketType>('repair')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [shopName, setShopName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const shopOptions = assignedShops.length > 0 ? assignedShops : SHOP_LIST
  const needsDateRange = ticketType === 'vacation' || ticketType === 'day_off'

  useEffect(() => {
    fetchTickets()
  }, [userId])

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('tickets')
        .insert({
          user_id: userId,
          ticket_type: ticketType,
          title: title.trim(),
          description: description.trim(),
          priority,
          shop_name: shopName || null,
          date_from: needsDateRange && dateFrom ? dateFrom : null,
          date_to: needsDateRange && dateTo ? dateTo : null,
          status: 'open',
          attachments: [],
        } as any)

      if (error) throw error

      // Reset form
      setTitle('')
      setDescription('')
      setPriority('normal')
      setShopName('')
      setDateFrom('')
      setDateTo('')
      setShowForm(false)
      fetchTickets()
    } catch (err) {
      console.error('Error creating ticket:', err)
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open': return '#3b82f6'
      case 'in_progress': return '#f59e0b'
      case 'approved': return '#10b981'
      case 'completed': return '#10b981'
      case 'rejected': return '#ef4444'
      case 'cancelled': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case 'open': return <Clock size={16} />
      case 'in_progress': return <AlertTriangle size={16} />
      case 'approved': return <CheckCircle size={16} />
      case 'completed': return <CheckCircle size={16} />
      case 'rejected': return <XCircle size={16} />
      case 'cancelled': return <XCircle size={16} />
      default: return <Clock size={16} />
    }
  }

  const getPriorityColor = (p: TicketPriority) => {
    switch (p) {
      case 'urgent': return '#ef4444'
      case 'high': return '#f59e0b'
      case 'normal': return '#3b82f6'
      case 'low': return '#6b7280'
    }
  }

  const filteredTickets = tickets.filter(t => {
    if (filter === 'open') return ['open', 'in_progress'].includes(t.status)
    if (filter === 'closed') return ['approved', 'rejected', 'completed', 'cancelled'].includes(t.status)
    return true
  })

  if (loading) {
    return (
      <div className="section-loading">
        <Loader2 size={32} className="spinning" />
        <p>Cargando solicitudes...</p>
      </div>
    )
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="section-icon">
          <Wrench size={24} />
        </div>
        <div>
          <h1>Solicitudes</h1>
          <p>Arreglos, vacaciones, francos y mas</p>
        </div>
        <button 
          className="btn-primary header-action"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} />
          Nueva solicitud
        </button>
      </div>

      {showForm && (
        <div className="ticket-form-card">
          <h3>Nueva solicitud</h3>
          <form onSubmit={handleSubmit}>
            <div className="ticket-type-selector">
              {(Object.keys(TICKET_TYPE_LABELS) as TicketType[]).map(type => {
                const Icon = TICKET_TYPE_ICONS[type]
                return (
                  <button
                    key={type}
                    type="button"
                    className={`type-option ${ticketType === type ? 'active' : ''}`}
                    onClick={() => setTicketType(type)}
                  >
                    <Icon size={20} />
                    <span>{TICKET_TYPE_LABELS[type]}</span>
                  </button>
                )
              })}
            </div>

            <div className="form-row two-cols">
              <div className="form-group flex-1">
                <label>Titulo</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Breve descripcion del pedido"
                  required
                />
              </div>
              <div className="form-group">
                <label>Prioridad</label>
                <select 
                  value={priority} 
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                >
                  {Object.entries(TICKET_PRIORITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {(ticketType === 'repair' || ticketType === 'supply') && (
              <div className="form-group">
                <label>Tienda (opcional)</label>
                <select 
                  value={shopName} 
                  onChange={(e) => setShopName(e.target.value)}
                >
                  <option value="">Seleccionar tienda...</option>
                  {shopOptions.map(shop => (
                    <option key={shop} value={shop}>{shop}</option>
                  ))}
                </select>
              </div>
            )}

            {needsDateRange && (
              <div className="form-row two-cols">
                <div className="form-group">
                  <label>Fecha desde</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    required={needsDateRange}
                  />
                </div>
                <div className="form-group">
                  <label>Fecha hasta</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    min={dateFrom}
                    required={needsDateRange}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Descripcion</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalla tu solicitud..."
                rows={4}
                required
              />
            </div>

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
                disabled={saving || !title.trim() || !description.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="spinning" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Crear solicitud
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="tickets-filter">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas ({tickets.length})
        </button>
        <button 
          className={`filter-btn ${filter === 'open' ? 'active' : ''}`}
          onClick={() => setFilter('open')}
        >
          Abiertas ({tickets.filter(t => ['open', 'in_progress'].includes(t.status)).length})
        </button>
        <button 
          className={`filter-btn ${filter === 'closed' ? 'active' : ''}`}
          onClick={() => setFilter('closed')}
        >
          Cerradas ({tickets.filter(t => !['open', 'in_progress'].includes(t.status)).length})
        </button>
      </div>

      <div className="tickets-list">
        {filteredTickets.length === 0 ? (
          <div className="empty-state">
            <Wrench size={48} />
            <h3>Sin solicitudes</h3>
            <p>{filter === 'all' ? 'Todavia no creaste ninguna solicitud' : 'No hay solicitudes con este filtro'}</p>
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const Icon = TICKET_TYPE_ICONS[ticket.ticket_type]
            return (
              <div 
                key={ticket.id} 
                className={`ticket-card ${expandedId === ticket.id ? 'expanded' : ''}`}
              >
                <button 
                  className="ticket-header"
                  onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
                >
                  <div className="ticket-icon">
                    <Icon size={20} />
                  </div>
                  <div className="ticket-info">
                    <div className="ticket-meta">
                      <span className="ticket-type">{TICKET_TYPE_LABELS[ticket.ticket_type]}</span>
                      <span 
                        className="ticket-priority"
                        style={{ color: getPriorityColor(ticket.priority) }}
                      >
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </span>
                      <span className="ticket-date">
                        {format(new Date(ticket.created_at), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    <h4 className="ticket-title">{ticket.title}</h4>
                    {ticket.shop_name && (
                      <span className="ticket-shop">{ticket.shop_name}</span>
                    )}
                  </div>
                  <div 
                    className="ticket-status"
                    style={{ color: getStatusColor(ticket.status) }}
                  >
                    {getStatusIcon(ticket.status)}
                    <span>{TICKET_STATUS_LABELS[ticket.status]}</span>
                  </div>
                  {expandedId === ticket.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {expandedId === ticket.id && (
                  <div className="ticket-body">
                    <div className="ticket-description">
                      <p>{ticket.description}</p>
                    </div>
                    
                    {(ticket.date_from || ticket.date_to) && (
                      <div className="ticket-dates">
                        <Calendar size={16} />
                        <span>
                          {ticket.date_from && format(new Date(ticket.date_from + 'T12:00:00'), "d 'de' MMMM", { locale: es })}
                          {ticket.date_to && ` - ${format(new Date(ticket.date_to + 'T12:00:00'), "d 'de' MMMM", { locale: es })}`}
                        </span>
                      </div>
                    )}
                    
                    {ticket.resolution && (
                      <div className="ticket-resolution">
                        <strong>Resolucion:</strong>
                        <p>{ticket.resolution}</p>
                        {ticket.resolved_at && (
                          <span className="resolution-date">
                            {format(new Date(ticket.resolved_at), "d/MM/yyyy HH:mm")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
