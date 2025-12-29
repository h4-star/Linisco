import { useState } from 'react'
import { format, subDays } from 'date-fns'
import { DollarSign, Receipt, TrendingUp, Users } from 'lucide-react'
import { Header } from './components/Header'
import { StatCard } from './components/StatCard'
import { SalesByShopChart } from './components/SalesByShopChart'
import { SalesByHourChart } from './components/SalesByHourChart'
import { PaymentMethodsChart } from './components/PaymentMethodsChart'
import { BlackSalesCard } from './components/BlackSalesCard'
import { TopProductsTable } from './components/TopProductsTable'
import { MigrationPanel } from './components/MigrationPanel'
import { LoginPage } from './components/LoginPage'
import { useSalesData } from './hooks/useSalesData'
import { useAuth } from './hooks/useAuth'

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
  
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  
  const [fromDate, setFromDate] = useState(weekAgo)
  const [toDate, setToDate] = useState(today)
  
  const { orders, products, loading, isDemo, refetch } = useSalesData(fromDate, toDate)

  // Pantalla de carga inicial de auth
  if (authLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Verificando sesión...</div>
      </div>
    )
  }

  // Si no está autenticado, mostrar login
  if (!isAuthenticated) {
    return (
      <LoginPage 
        onLogin={signIn}
        error={authError}
        loading={authLoading}
      />
    )
  }

  // Calculate stats
  const totalSales = orders.reduce((sum, o) => sum + o.total, 0)
  const totalSalesNoIVA = totalSales / 1.21
  const totalTickets = orders.length
  const avgTicket = totalTickets > 0 ? totalSales / totalTickets : 0
  const uniqueShops = new Set(orders.map(o => o.shopName)).size

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Cargando datos...</div>
      </div>
    )
  }

  return (
    <>
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
      />

      <main className="container" style={{ paddingBottom: '48px' }}>
        {/* Stats Grid */}
        <div className="grid-stats">
          <StatCard
            title="Ventas Totales"
            value={formatCurrency(totalSalesNoIVA)}
            subtitle="Sin IVA"
            icon={DollarSign}
            delay={1}
          />
          <StatCard
            title="Tickets"
            value={totalTickets.toLocaleString('es-AR')}
            subtitle="Transacciones"
            icon={Receipt}
            delay={2}
          />
          <StatCard
            title="Ticket Promedio"
            value={formatCurrency(avgTicket)}
            subtitle="Por transacción"
            icon={TrendingUp}
            delay={3}
          />
          <StatCard
            title="Locales Activos"
            value={uniqueShops.toString()}
            subtitle="Con ventas"
            icon={Users}
            delay={4}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid-charts">
          <SalesByShopChart orders={orders} />
          <BlackSalesCard orders={orders} />
          <SalesByHourChart orders={orders} />
          <PaymentMethodsChart orders={orders} />
          <TopProductsTable products={products} />
        </div>
      </main>

      {/* Panel de migración flotante */}
      <MigrationPanel />
    </>
  )
}

export default App
