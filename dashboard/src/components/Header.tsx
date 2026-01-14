import { Store, RefreshCw, AlertCircle, LogOut, User, DollarSign, Wrench, FileText, Package } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

type AdminView = 'dashboard' | 'closings' | 'tickets' | 'invoices' | 'inventory'

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
  isAdmin?: boolean
  adminView?: AdminView
  onChangeView?: (view: AdminView) => void
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
  onSignOut,
  isAdmin,
  adminView = 'dashboard',
  onChangeView
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
          
          {/* Date filters - show on dashboard and closings views */}
          {(adminView === 'dashboard' || adminView === 'closings') && (
            <>
              <input
                type="date"
                className="date-input"
                value={fromDate}
                max={toDate}
                onChange={(e) => {
                  const newFromDate = e.target.value
                  if (newFromDate <= toDate) {
                    onFromDateChange(newFromDate)
                  }
                }}
                title="Fecha desde"
              />
              <span style={{ color: 'var(--text-muted)' }}>a</span>
              <input
                type="date"
                className="date-input"
                value={toDate}
                min={fromDate}
                onChange={(e) => {
                  const newToDate = e.target.value
                  if (newToDate >= fromDate) {
                    onToDateChange(newToDate)
                  }
                }}
                title="Fecha hasta"
              />
              <button className="btn" onClick={onRefresh} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                Actualizar
              </button>
            </>
          )}

          {/* Admin navigation */}
          {isAdmin && onChangeView && (
            <div className="admin-nav">
              <button 
                className={`btn ${adminView === 'dashboard' ? 'btn-active' : 'btn-secondary'}`}
                onClick={() => onChangeView('dashboard')}
                title="Dashboard de ventas"
              >
                <Store size={16} />
                Ventas
              </button>
              <button 
                className={`btn ${adminView === 'closings' ? 'btn-active' : 'btn-secondary'}`}
                onClick={() => onChangeView('closings')}
                title="Cierres de caja"
              >
                <DollarSign size={16} />
                Cierres
              </button>
              <button 
                className={`btn ${adminView === 'tickets' ? 'btn-active' : 'btn-secondary'}`}
                onClick={() => onChangeView('tickets')}
                title="Solicitudes de empleados"
              >
                <Wrench size={16} />
                Solicitudes
              </button>
              <button 
                className={`btn ${adminView === 'invoices' ? 'btn-active' : 'btn-secondary'}`}
                onClick={() => onChangeView('invoices')}
                title="Facturas de compra"
              >
                <FileText size={16} />
                Facturas
              </button>
              <button 
                className={`btn ${adminView === 'inventory' ? 'btn-active' : 'btn-secondary'}`}
                onClick={() => onChangeView('inventory')}
                title="Inventario"
              >
                <Package size={16} />
                Inventario
              </button>
            </div>
          )}

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
                title="Cerrar sesion"
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
