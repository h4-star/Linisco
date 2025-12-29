import { Store, RefreshCw, AlertCircle, LogOut, User } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface HeaderProps {
  fromDate: string
  toDate: string
  onFromDateChange: (date: string) => void
  onToDateChange: (date: string) => void
  onRefresh: () => void
  loading: boolean
  isDemo: boolean
  user?: SupabaseUser | null
  onSignOut?: () => void
}

export function Header({ 
  fromDate, 
  toDate, 
  onFromDateChange, 
  onToDateChange, 
  onRefresh, 
  loading,
  isDemo,
  user,
  onSignOut
}: HeaderProps) {
  return (
    <header className="header">
      <div className="container header-content">
        <div className="logo">
          <div className="logo-icon">
            <Store size={24} />
          </div>
          <div>
            <div className="logo-text">Linisco</div>
            <div className="logo-subtitle">Dashboard de Ventas</div>
          </div>
        </div>

        <div className="date-filter">
          {isDemo && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 500
            }}>
              <AlertCircle size={14} />
              Modo Demo
            </div>
          )}
          
          <input
            type="date"
            className="date-input"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
          />
          <span style={{ color: 'var(--text-muted)' }}>a</span>
          <input
            type="date"
            className="date-input"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
          />
          <button className="btn" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Actualizar
          </button>

          {/* User menu */}
          {user && (
            <div className="user-menu">
              <div className="user-info">
                <User size={16} />
                <span className="user-email">{user.email}</span>
              </div>
              <button 
                className="btn btn-secondary logout-btn" 
                onClick={onSignOut}
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
