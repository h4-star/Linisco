import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { DollarSign, Receipt, TrendingUp, Users } from 'lucide-react'
import { Header } from './components/Header'
import { StatCard } from './components/StatCard'
import { SalesByShopChart } from './components/SalesByShopChart'
import { SalesByHourChart } from './components/SalesByHourChart'
import { PaymentMethodsChart } from './components/PaymentMethodsChart'
import { DailySalesTrendChart } from './components/DailySalesTrendChart'
import { TopProductsTable } from './components/TopProductsTable'
import { SyncStatus } from './components/SyncStatus'
import { LoginPage } from './components/LoginPage'
import { EmployeePortal } from './components/employee'
import { AdminCashClosingsPanel, AdminTicketsPanel } from './components/admin'
import { useSalesData } from './hooks/useSalesData'
import { useAuth } from './hooks/useAuth'
import { useUserRole } from './hooks/useUserRole'

type AdminView = 'dashboard' | 'closings' | 'tickets'

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function App() {
  const { user, loading: authLoading, error: authError, isAuthenticated, signIn, signOut } = useAuth()
  const { profile, loading: roleLoading, isAdmin, updateProfile } = useUserRole(user?.id)
  
  const today = format(new Date(), 'yyyy-MM-dd')
  // Por defecto mostrar el día actual
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [adminView, setAdminView] = useState<AdminView>('dashboard')
  
  const { orders, products, loading, isDemo, refetch } = useSalesData(fromDate, toDate)

  // Pantalla de carga inicial
  if (authLoading || roleLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Verificando sesion...</div>
      </div>
    )
  }

  // Si no está autenticado, mostrar login
  if (!isAuthenticated || !user) {
    return (
      <LoginPage 
        onLogin={signIn}
        error={authError}
        loading={authLoading}
      />
    )
  }

  // Si es empleado (no admin), mostrar portal de empleados
  if (!isAdmin) {
    return (
      <EmployeePortal
        user={user}
        profile={profile}
        onSignOut={signOut}
        onProfileUpdate={updateProfile}
      />
    )
  }

  // Dashboard de admin - Memoizar cálculos pesados
  const stats = useMemo(() => {
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0)
    const totalSalesNoIVA = totalSales / 1.21
    const totalTickets = orders.length
    const avgTicket = totalTickets > 0 ? totalSales / totalTickets : 0
    const uniqueShops = new Set(orders.map(o => o.shopName)).size
    
    return { totalSales, totalSalesNoIVA, totalTickets, avgTicket, uniqueShops }
  }, [orders])

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Cargando datos...</div>
      </div>
    )
  }

  const renderAdminContent = () => {
    switch (adminView) {
      case 'closings':
        return (
          <AdminCashClosingsPanel 
            orders={orders} 
            fromDate={fromDate} 
            toDate={toDate} 
          />
        )
      case 'tickets':
        return <AdminTicketsPanel />
      default:
        return (
          <>
            {/* Stats Grid */}
            <div className="grid-stats">
              <StatCard
                title="Ventas Totales"
                value={formatCurrency(stats.totalSalesNoIVA)}
                subtitle="Sin IVA"
                icon={DollarSign}
                delay={1}
              />
              <StatCard
                title="Tickets"
                value={stats.totalTickets.toLocaleString('es-AR')}
                subtitle="Transacciones"
                icon={Receipt}
                delay={2}
              />
              <StatCard
                title="Ticket Promedio"
                value={formatCurrency(stats.avgTicket)}
                subtitle="Por transaccion"
                icon={TrendingUp}
                delay={3}
              />
              <StatCard
                title="Locales Activos"
                value={stats.uniqueShops.toString()}
                subtitle="Con ventas"
                icon={Users}
                delay={4}
              />
            </div>

            {/* Charts Grid */}
            <div className="grid-charts">
              <DailySalesTrendChart orders={orders} />
              <SalesByShopChart orders={orders} />
              <SalesByHourChart orders={orders} fromDate={fromDate} toDate={toDate} />
              <PaymentMethodsChart orders={orders} />
              <TopProductsTable products={products} />
            </div>
          </>
        )
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f0d', color: '#f0fdf4' }}>
      <Header
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onRefresh={refetch}
        loading={loading}
        isDemo={isDemo}
        user={user}
        onSignOut={signOut}
        isAdmin={isAdmin}
        adminView={adminView}
        onChangeView={setAdminView}
      />

      <main className="container" style={{ paddingBottom: '48px' }}>
        {renderAdminContent()}
      </main>

      <SyncStatus />
    </div>
  )
}

export default App
