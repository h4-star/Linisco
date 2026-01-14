import { useState } from 'react'
import { 
  User, DollarSign, Wrench, Calendar, FileText, Package,
  LogOut, Menu, X, ChevronRight, Home
} from 'lucide-react'
import type { User as AuthUser } from '@supabase/supabase-js'
import type { UserProfile } from '../../types/database'
import { ProfileSection } from './ProfileSection'
import { CashClosingSection } from './CashClosingSection'
import { TicketsSection } from './TicketsSection'
import { PurchaseInvoiceSection } from './PurchaseInvoiceSection'
import { InventorySection } from './InventorySection'

type Section = 'home' | 'profile' | 'cash' | 'tickets' | 'invoices' | 'inventory'

interface EmployeePortalProps {
  user: AuthUser
  profile: UserProfile | null
  onSignOut: () => void
  onProfileUpdate: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error: string | null }>
}

const NAV_ITEMS: { id: Section; label: string; icon: typeof User; description: string }[] = [
  { id: 'home', label: 'Inicio', icon: Home, description: 'Panel principal' },
  { id: 'profile', label: 'Mi Perfil', icon: User, description: 'Datos personales' },
  { id: 'cash', label: 'Cierre de Caja', icon: DollarSign, description: 'Reportar cierres' },
  { id: 'tickets', label: 'Solicitudes', icon: Wrench, description: 'Arreglos, vacaciones, francos' },
  { id: 'invoices', label: 'Facturas de Compra', icon: FileText, description: 'Cargar facturas de compra' },
  { id: 'inventory', label: 'Inventario', icon: Package, description: 'Productos y compras' },
]

export function EmployeePortal({ user, profile, onSignOut, onProfileUpdate }: EmployeePortalProps) {
  const [activeSection, setActiveSection] = useState<Section>('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const displayName = profile?.full_name || user.email?.split('@')[0] || 'Usuario'

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSection user={user} profile={profile} onUpdate={onProfileUpdate} />
      case 'cash':
        return <CashClosingSection userId={user.id} assignedShops={profile?.assigned_shops || []} />
      case 'tickets':
        return <TicketsSection userId={user.id} assignedShops={profile?.assigned_shops || []} />
      case 'invoices':
        return <PurchaseInvoiceSection userId={user.id} assignedShops={profile?.assigned_shops || []} />
      case 'inventory':
        return <InventorySection userId={user.id} assignedShops={profile?.assigned_shops || []} />
      default:
        return <HomeSection userName={displayName} onNavigate={setActiveSection} />
    }
  }

  return (
    <div className="employee-portal">
      {/* Mobile header */}
      <header className="employee-header-mobile">
        <button 
          className="menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="employee-logo">
          <div className="employee-logo-icon">L</div>
          <span>Linisco</span>
        </div>
        <button className="logout-btn-mobile" onClick={onSignOut}>
          <LogOut size={20} />
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`employee-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="employee-logo">
            <div className="employee-logo-icon">L</div>
            <div className="employee-logo-text">
              <span className="logo-title">Linisco</span>
              <span className="logo-subtitle">Portal Empleados</span>
            </div>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="user-info-sidebar">
            <span className="user-name">{displayName}</span>
            <span className="user-email">{user.email}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveSection(item.id)
                setSidebarOpen(false)
              }}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              <ChevronRight size={16} className="nav-arrow" />
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn-sidebar" onClick={onSignOut}>
            <LogOut size={18} />
            <span>Cerrar Sesion</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="employee-main">
        <div className="employee-content">
          {renderContent()}
        </div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

// Home section component
function HomeSection({ userName, onNavigate }: { userName: string; onNavigate: (s: Section) => void }) {
  const quickActions = [
    { 
      id: 'cash' as Section, 
      title: 'Reportar Cierre', 
      description: 'Cargar cierre de caja del turno',
      icon: DollarSign,
      color: '#10b981'
    },
    { 
      id: 'tickets' as Section, 
      title: 'Nueva Solicitud', 
      description: 'Vacaciones, francos, arreglos',
      icon: Calendar,
      color: '#f59e0b'
    },
    { 
      id: 'invoices' as Section, 
      title: 'Facturas de Compra', 
      description: 'Cargar facturas de compra',
      icon: FileText,
      color: '#3b82f6'
    },
    { 
      id: 'inventory' as Section, 
      title: 'Inventario', 
      description: 'Productos y compras',
      icon: Package,
      color: '#10b981'
    },
    { 
      id: 'profile' as Section, 
      title: 'Mi Perfil', 
      description: 'Ver y editar datos',
      icon: User,
      color: '#8b5cf6'
    },
  ]

  return (
    <div className="home-section">
      <div className="home-welcome">
        <h1>Hola, {userName}!</h1>
        <p>Bienvenido al portal de empleados de Linisco</p>
      </div>

      <div className="quick-actions-grid">
        {quickActions.map(action => (
          <button
            key={action.id}
            className="quick-action-card"
            onClick={() => onNavigate(action.id)}
          >
            <div 
              className="quick-action-icon"
              style={{ backgroundColor: `${action.color}20`, color: action.color }}
            >
              <action.icon size={28} />
            </div>
            <div className="quick-action-content">
              <h3>{action.title}</h3>
              <p>{action.description}</p>
            </div>
            <ChevronRight size={20} className="quick-action-arrow" />
          </button>
        ))}
      </div>

      <div className="home-info">
        <h2>Acciones Rapidas</h2>
        <p>
          Desde este portal podes reportar tus cierres de caja, solicitar vacaciones 
          o francos, y reportar cualquier problema que necesite atencion.
        </p>
      </div>
    </div>
  )
}
