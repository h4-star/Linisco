import { useState, useEffect } from 'react'
import { 
  MessageSquare, Send, Loader2, ChevronDown, ChevronUp,
  AlertCircle, Clock, CheckCircle, MessageCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { EmployeeMessage, MessageCategory } from '../../types/database'
import { MESSAGE_CATEGORY_LABELS } from '../../types/database'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface MessagesSectionProps {
  userId: string
}

export function MessagesSection({ userId }: MessagesSectionProps) {
  const [messages, setMessages] = useState<EmployeeMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  
  // Form state
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState<MessageCategory>('general')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchMessages()
  }, [userId])

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setMessages(data || [])
    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('employee_messages')
        .insert({
          user_id: userId,
          subject: subject.trim(),
          message: message.trim(),
          category,
          status: 'pending',
        } as any)

      if (error) throw error

      setSubject('')
      setMessage('')
      setCategory('general')
      setShowForm(false)
      fetchMessages()
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} className="status-pending" />
      case 'read': return <CheckCircle size={16} className="status-read" />
      case 'replied': return <MessageCircle size={16} className="status-replied" />
      default: return null
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente'
      case 'read': return 'Leido'
      case 'replied': return 'Respondido'
      case 'archived': return 'Archivado'
      default: return status
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

  if (loading) {
    return (
      <div className="section-loading">
        <Loader2 size={32} className="spinning" />
        <p>Cargando mensajes...</p>
      </div>
    )
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="section-icon">
          <MessageSquare size={24} />
        </div>
        <div>
          <h1>Mensajes</h1>
          <p>Comunicacion con los jefes</p>
        </div>
        <button 
          className="btn-primary header-action"
          onClick={() => setShowForm(!showForm)}
        >
          <Send size={18} />
          Nuevo mensaje
        </button>
      </div>

      {showForm && (
        <div className="message-form-card">
          <h3>Nuevo mensaje</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Categoria</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value as MessageCategory)}
                >
                  {Object.entries(MESSAGE_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group flex-1">
                <label>Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del mensaje"
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Mensaje</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribi tu mensaje..."
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
                disabled={sending || !subject.trim() || !message.trim()}
              >
                {sending ? (
                  <>
                    <Loader2 size={18} className="spinning" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Enviar mensaje
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} />
            <h3>Sin mensajes</h3>
            <p>Todavia no enviaste ningun mensaje</p>
          </div>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              className={`message-card ${expandedId === msg.id ? 'expanded' : ''}`}
            >
              <button 
                className="message-header"
                onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
              >
                <div className="message-meta">
                  <span 
                    className="message-category"
                    style={{ backgroundColor: `${getCategoryColor(msg.category)}20`, color: getCategoryColor(msg.category) }}
                  >
                    {MESSAGE_CATEGORY_LABELS[msg.category]}
                  </span>
                  <span className="message-date">
                    {format(new Date(msg.created_at), "d 'de' MMM, HH:mm", { locale: es })}
                  </span>
                </div>
                <h4 className="message-subject">{msg.subject}</h4>
                <div className="message-status">
                  {getStatusIcon(msg.status)}
                  <span>{getStatusLabel(msg.status)}</span>
                  {expandedId === msg.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {expandedId === msg.id && (
                <div className="message-body">
                  <div className="message-content">
                    <p>{msg.message}</p>
                  </div>
                  
                  {msg.admin_reply && (
                    <div className="admin-reply">
                      <div className="reply-header">
                        <AlertCircle size={16} />
                        <span>Respuesta del administrador</span>
                        {msg.replied_at && (
                          <span className="reply-date">
                            {format(new Date(msg.replied_at), "d/MM/yyyy HH:mm")}
                          </span>
                        )}
                      </div>
                      <p>{msg.admin_reply}</p>
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
