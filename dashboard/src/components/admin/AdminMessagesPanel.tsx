import { useState, useEffect } from 'react'
import { 
  MessageSquare, Send, Loader2, ChevronDown, ChevronUp,
  Clock, CheckCircle, MessageCircle, Archive, Inbox, Filter
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { EmployeeMessage, MessageCategory, MessageStatus } from '../../types/database'
import { MESSAGE_CATEGORY_LABELS } from '../../types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function AdminMessagesPanel() {
  const [messages, setMessages] = useState<EmployeeMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'replied'>('pending')

  useEffect(() => {
    fetchMessages()
  }, [])

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_messages')
        .select(`
          *,
          user:user_profiles!employee_messages_user_id_fkey(id, email, full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMessages(data || [])
    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async (messageId: number) => {
    if (!replyText.trim()) return
    
    setReplying(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('employee_messages')
        .update({
          admin_reply: replyText.trim(),
          status: 'replied',
          replied_at: new Date().toISOString(),
          replied_by: userData.user?.id,
        } as any as never)
        .eq('id', messageId)

      if (error) throw error
      
      setReplyText('')
      setExpandedId(null)
      fetchMessages()
    } catch (err) {
      console.error('Error replying:', err)
    } finally {
      setReplying(false)
    }
  }

  const handleMarkAsRead = async (messageId: number) => {
    try {
      await supabase
        .from('employee_messages')
        .update({ status: 'read' } as any as never)
        .eq('id', messageId)
      
      fetchMessages()
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  const handleArchive = async (messageId: number) => {
    try {
      await supabase
        .from('employee_messages')
        .update({ status: 'archived' } as any as never)
        .eq('id', messageId)
      
      fetchMessages()
    } catch (err) {
      console.error('Error archiving:', err)
    }
  }

  const getStatusIcon = (status: MessageStatus) => {
    switch (status) {
      case 'pending': return <Clock size={16} className="status-pending" />
      case 'read': return <CheckCircle size={16} className="status-read" />
      case 'replied': return <MessageCircle size={16} className="status-replied" />
      case 'archived': return <Archive size={16} className="status-archived" />
    }
  }

  const getCategoryColor = (cat: MessageCategory) => {
    switch (cat) {
      case 'urgente': return '#ef4444'
      case 'sugerencia': return '#10b981'
      case 'reclamo': return '#f59e0b'
      case 'consulta': return '#3b82f6'
      default: return '#6b7280'
    }
  }

  const filteredMessages = messages.filter(m => {
    if (filter === 'pending') return m.status === 'pending' || m.status === 'read'
    if (filter === 'replied') return m.status === 'replied'
    return m.status !== 'archived'
  })

  const pendingCount = messages.filter(m => m.status === 'pending').length

  if (loading) {
    return (
      <div className="admin-panel-loading">
        <Loader2 size={32} className="spinning" />
        <p>Cargando mensajes...</p>
      </div>
    )
  }

  return (
    <div className="admin-messages-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Inbox size={24} />
          <div>
            <h2>Mensajes de Empleados</h2>
            <p>{pendingCount} mensaje{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="panel-filters">
          <Filter size={16} />
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pendientes
          </button>
          <button 
            className={`filter-btn ${filter === 'replied' ? 'active' : ''}`}
            onClick={() => setFilter('replied')}
          >
            Respondidos
          </button>
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
        </div>
      </div>

      <div className="admin-messages-list">
        {filteredMessages.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} />
            <h3>Sin mensajes</h3>
            <p>No hay mensajes {filter === 'pending' ? 'pendientes' : 'en esta categoria'}</p>
          </div>
        ) : (
          filteredMessages.map(msg => (
            <div 
              key={msg.id} 
              className={`admin-message-card ${expandedId === msg.id ? 'expanded' : ''} ${msg.status === 'pending' ? 'unread' : ''}`}
            >
              <button 
                className="message-header"
                onClick={() => {
                  setExpandedId(expandedId === msg.id ? null : msg.id)
                  if (msg.status === 'pending') {
                    handleMarkAsRead(msg.id)
                  }
                }}
              >
                <div className="message-sender">
                  <div className="sender-avatar">
                    {(msg.user?.full_name || msg.user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="sender-info">
                    <span className="sender-name">{msg.user?.full_name || 'Sin nombre'}</span>
                    <span className="sender-email">{msg.user?.email}</span>
                  </div>
                </div>
                <div className="message-meta">
                  <span 
                    className="message-category"
                    style={{ backgroundColor: `${getCategoryColor(msg.category)}20`, color: getCategoryColor(msg.category) }}
                  >
                    {MESSAGE_CATEGORY_LABELS[msg.category]}
                  </span>
                  <span className="message-date">
                    {format(new Date(msg.created_at), "d MMM, HH:mm", { locale: es })}
                  </span>
                  {getStatusIcon(msg.status)}
                </div>
                <h4 className="message-subject">{msg.subject}</h4>
                {expandedId === msg.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {expandedId === msg.id && (
                <div className="message-body">
                  <div className="message-content">
                    <p>{msg.message}</p>
                  </div>
                  
                  {msg.admin_reply ? (
                    <div className="existing-reply">
                      <div className="reply-header">
                        <MessageCircle size={16} />
                        <span>Tu respuesta</span>
                        <span className="reply-date">
                          {msg.replied_at && format(new Date(msg.replied_at), "d/MM/yyyy HH:mm")}
                        </span>
                      </div>
                      <p>{msg.admin_reply}</p>
                    </div>
                  ) : (
                    <div className="reply-form">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Escribi tu respuesta..."
                        rows={3}
                      />
                      <div className="reply-actions">
                        <button 
                          className="btn-secondary"
                          onClick={() => handleArchive(msg.id)}
                        >
                          <Archive size={16} />
                          Archivar
                        </button>
                        <button 
                          className="btn-primary"
                          onClick={() => handleReply(msg.id)}
                          disabled={replying || !replyText.trim()}
                        >
                          {replying ? (
                            <Loader2 size={16} className="spinning" />
                          ) : (
                            <Send size={16} />
                          )}
                          Responder
                        </button>
                      </div>
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
