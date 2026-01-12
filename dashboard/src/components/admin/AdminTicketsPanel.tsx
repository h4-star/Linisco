import { useState, useEffect } from 'react'
import { 
  Wrench, Loader2, CheckCircle, AlertTriangle, XCircle, Clock,
  ChevronDown, ChevronUp, Send
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Ticket, TicketType, TicketPriority, TicketStatus, TicketComment } from '../../types/database'
import { 
  SHOP_LIST, TICKET_TYPE_LABELS, TICKET_PRIORITY_LABELS, 
  TICKET_STATUS_LABELS 
} from '../../types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface TicketWithUser extends Omit<Ticket, 'user'> {
  user?: {
    email: string
    full_name: string | null
  }
  comments?: TicketComment[]
}

const TICKET_TYPE_ICONS: Record<TicketType, typeof Wrench> = {
  repair: Wrench,
  vacation: Clock,
  day_off: Clock,
  supply: Wrench,
  other: AlertTriangle,
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: '#6b7280',
  normal: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: '#3b82f6',
  in_progress: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  completed: '#10b981',
  cancelled: '#6b7280',
}

export function AdminTicketsPanel() {
  const [tickets, setTickets] = useState<TicketWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterShop, setFilterShop] = useState<string>('')
  const [updating, setUpdating] = useState<number | null>(null)
  const [commentText, setCommentText] = useState<Record<number, string>>({})
  const [sendingComment, setSendingComment] = useState<number | null>(null)

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          user:user_profiles!tickets_user_id_fkey(email, full_name),
          comments:ticket_comments(
            *,
            user:user_profiles!ticket_comments_user_id_fkey(email, full_name)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (ticketId: number, newStatus: TicketStatus) => {
    setUpdating(ticketId)
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        } as any as never)
        .eq('id', ticketId)

      if (error) throw error
      fetchTickets()
    } catch (err) {
      console.error('Error updating ticket:', err)
      alert('Error al actualizar el ticket')
    } finally {
      setUpdating(null)
    }
  }

  const handleAddComment = async (ticketId: number) => {
    const comment = commentText[ticketId]?.trim()
    if (!comment) return

    setSendingComment(ticketId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay usuario autenticado')

      const { error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          comment: comment
        } as any as never)

      if (error) throw error

      setCommentText(prev => ({ ...prev, [ticketId]: '' }))
      fetchTickets()
    } catch (err) {
      console.error('Error adding comment:', err)
      alert('Error al agregar comentario')
    } finally {
      setSendingComment(null)
    }
  }

  const filteredTickets = tickets.filter(ticket => {
    if (filterStatus && ticket.status !== filterStatus) return false
    if (filterType && ticket.ticket_type !== filterType) return false
    if (filterShop && ticket.shop_name !== filterShop) return false
    return true
  })

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case 'open': return <AlertTriangle size={16} />
      case 'in_progress': return <Clock size={16} />
      case 'approved': return <CheckCircle size={16} />
      case 'rejected': return <XCircle size={16} />
      case 'completed': return <CheckCircle size={16} />
      case 'cancelled': return <XCircle size={16} />
      default: return <Clock size={16} />
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Loader2 size={32} className="spinning" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
          Solicitudes de Empleados
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Gestiona todas las solicitudes, vacaciones, francos y reportes de los empleados
        </p>
      </div>

      {/* Filtros */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '12px',
        marginBottom: '24px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Estado
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="">Todos</option>
            {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Tipo
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="">Todos</option>
            {Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Local
          </label>
          <select
            value={filterShop}
            onChange={(e) => setFilterShop(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="">Todos</option>
            {SHOP_LIST.map(shop => (
              <option key={shop} value={shop}>{shop}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de tickets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredTickets.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '48px', 
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)'
          }}>
            <Wrench size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>No hay solicitudes para mostrar</p>
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const TypeIcon = TICKET_TYPE_ICONS[ticket.ticket_type]
            const isExpanded = expandedId === ticket.id

            return (
              <div
                key={ticket.id}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden'
                }}
              >
                {/* Header del ticket */}
                <div
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: isExpanded ? 'var(--bg-primary)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                >
                  <TypeIcon size={20} style={{ color: PRIORITY_COLORS[ticket.priority] }} />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                        {ticket.title}
                      </h3>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: `${PRIORITY_COLORS[ticket.priority]}20`,
                        color: PRIORITY_COLORS[ticket.priority]
                      }}>
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: `${STATUS_COLORS[ticket.status]}20`,
                        color: STATUS_COLORS[ticket.status],
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {getStatusIcon(ticket.status)}
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {ticket.user?.full_name || ticket.user?.email} • {ticket.shop_name || 'Sin local'} • {format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </div>
                  </div>

                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Descripción</h4>
                      <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                        {ticket.description}
                      </p>
                    </div>

                    {(ticket.date_from || ticket.date_to) && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Fechas</h4>
                        <p style={{ color: 'var(--text-secondary)' }}>
                          {ticket.date_from && format(new Date(ticket.date_from), 'dd/MM/yyyy', { locale: es })}
                          {ticket.date_from && ticket.date_to && ' - '}
                          {ticket.date_to && format(new Date(ticket.date_to), 'dd/MM/yyyy', { locale: es })}
                        </p>
                      </div>
                    )}

                    {/* Comentarios */}
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px' }}>
                        Comentarios ({ticket.comments?.length || 0})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        {ticket.comments && ticket.comments.length > 0 ? (
                          ticket.comments.map(comment => (
                            <div
                              key={comment.id}
                              style={{
                                padding: '12px',
                                background: 'var(--bg-primary)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                  {comment.user?.full_name || comment.user?.email}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {format(new Date(comment.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                                </span>
                              </div>
                              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                {comment.comment}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No hay comentarios
                          </p>
                        )}
                      </div>

                      {/* Agregar comentario */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={commentText[ticket.id] || ''}
                          onChange={(e) => setCommentText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                          placeholder="Agregar comentario..."
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)'
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddComment(ticket.id)
                            }
                          }}
                        />
                        <button
                          onClick={() => handleAddComment(ticket.id)}
                          disabled={sendingComment === ticket.id || !commentText[ticket.id]?.trim()}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: 'var(--accent-primary)',
                            color: 'white',
                            cursor: sendingComment === ticket.id ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {sendingComment === ticket.id ? (
                            <Loader2 size={16} className="spinning" />
                          ) : (
                            <Send size={16} />
                          )}
                          Enviar
                        </button>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {ticket.status === 'open' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(ticket.id, 'in_progress')}
                            disabled={updating === ticket.id}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              background: '#f59e0b',
                              color: 'white',
                              cursor: updating === ticket.id ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            {updating === ticket.id ? <Loader2 size={16} className="spinning" /> : 'En Progreso'}
                          </button>
                          <button
                            onClick={() => handleStatusChange(ticket.id, 'approved')}
                            disabled={updating === ticket.id}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              background: '#10b981',
                              color: 'white',
                              cursor: updating === ticket.id ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            {updating === ticket.id ? <Loader2 size={16} className="spinning" /> : 'Aprobar'}
                          </button>
                          <button
                            onClick={() => handleStatusChange(ticket.id, 'rejected')}
                            disabled={updating === ticket.id}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              background: '#ef4444',
                              color: 'white',
                              cursor: updating === ticket.id ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            {updating === ticket.id ? <Loader2 size={16} className="spinning" /> : 'Rechazar'}
                          </button>
                        </>
                      )}
                      {ticket.status === 'in_progress' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(ticket.id, 'completed')}
                            disabled={updating === ticket.id}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              background: '#10b981',
                              color: 'white',
                              cursor: updating === ticket.id ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            {updating === ticket.id ? <Loader2 size={16} className="spinning" /> : 'Completar'}
                          </button>
                          <button
                            onClick={() => handleStatusChange(ticket.id, 'open')}
                            disabled={updating === ticket.id}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-color)',
                              background: 'transparent',
                              color: 'var(--text-primary)',
                              cursor: updating === ticket.id ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            {updating === ticket.id ? <Loader2 size={16} className="spinning" /> : 'Volver a Abierto'}
                          </button>
                        </>
                      )}
                      {(ticket.status === 'approved' || ticket.status === 'rejected') && (
                        <button
                          onClick={() => handleStatusChange(ticket.id, 'open')}
                          disabled={updating === ticket.id}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            cursor: updating === ticket.id ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          {updating === ticket.id ? <Loader2 size={16} className="spinning" /> : 'Reabrir'}
                        </button>
                      )}
                    </div>
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
