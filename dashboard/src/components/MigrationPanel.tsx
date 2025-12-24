import { useState } from 'react'
import { Database, Play, Loader2, CheckCircle, XCircle, Calendar, Store } from 'lucide-react'

interface MigrationResult {
  success: boolean
  message: string
  orders?: number
  products?: number
  sessions?: number
}

// Lista de locales disponibles
const AVAILABLE_SHOPS = [
  { key: 'SC', name: 'Subway Corrientes' },
  { key: 'SL', name: 'Subway Lacroze' },
  { key: 'SO', name: 'Subway Ortiz' },
  { key: 'DO', name: 'Daniel Ortiz' },
  { key: 'DL', name: 'Daniel Lacroze' },
  { key: 'DC', name: 'Daniel Corrientes' },
  { key: 'SE', name: 'Seitu Juramento' },
  { key: 'SJ', name: 'Subway Juramento' },
]

export function MigrationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedShops, setSelectedShops] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)

  const formatDateForAPI = (date: string) => {
    const [year, month, day] = date.split('-')
    return `${day}/${month}/${year}`
  }

  const toggleShop = (key: string) => {
    setSelectedShops(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    )
  }

  const selectAll = () => {
    setSelectedShops(AVAILABLE_SHOPS.map(s => s.key))
  }

  const selectNone = () => {
    setSelectedShops([])
  }

  const handleMigration = async () => {
    if (!fromDate || !toDate) {
      setResult({ success: false, message: 'Seleccioná ambas fechas' })
      return
    }

    if (selectedShops.length === 0) {
      setResult({ success: false, message: 'Seleccioná al menos un local' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const requestBody = {
        fromDate: formatDateForAPI(fromDate),
        toDate: formatDateForAPI(toDate),
        shops: selectedShops
      }
      
      console.log('Sending migration request:', requestBody)
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      const response = await fetch(`${supabaseUrl}/functions/v1/migrate-sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()
      console.log('Migration response:', data)

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Error en la migración')
      }

      setResult({
        success: true,
        message: 'Migración completada',
        orders: data?.orders || 0,
        products: data?.products || 0,
        sessions: data?.sessions || 0
      })
    } catch (err) {
      console.error('Migration error:', err)
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Error en la migración'
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-secondary"
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px',
          zIndex: 1000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}
      >
        <Database size={16} />
        Migrar Datos
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 1000,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      width: '380px',
      maxHeight: '80vh',
      overflowY: 'auto',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          margin: 0,
          fontSize: '1rem'
        }}>
          <Database size={18} style={{ color: 'var(--accent-primary)' }} />
          Migrar desde POS
        </h3>
        <button 
          onClick={() => setIsOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '1.5rem',
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>

      {/* Fechas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Calendar size={10} style={{ marginRight: '4px' }} />
            Desde
          </label>
          <input
            type="date"
            className="date-input"
            style={{ width: '100%', padding: '8px' }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Calendar size={10} style={{ marginRight: '4px' }} />
            Hasta
          </label>
          <input
            type="date"
            className="date-input"
            style={{ width: '100%', padding: '8px' }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* Selector de locales */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Store size={10} />
            Locales ({selectedShops.length}/{AVAILABLE_SHOPS.length})
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={selectAll}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--accent-primary)', 
                cursor: 'pointer',
                fontSize: '0.7rem',
                textDecoration: 'underline'
              }}
            >
              Todos
            </button>
            <button 
              onClick={selectNone}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-muted)', 
                cursor: 'pointer',
                fontSize: '0.7rem',
                textDecoration: 'underline'
              }}
            >
              Ninguno
            </button>
          </div>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '6px',
          maxHeight: '150px',
          overflowY: 'auto',
          padding: '8px',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)'
        }}>
          {AVAILABLE_SHOPS.map(shop => (
            <label 
              key={shop.key}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                background: selectedShops.includes(shop.key) ? 'var(--accent-glow)' : 'transparent',
                border: selectedShops.includes(shop.key) ? '1px solid var(--accent-primary)' : '1px solid transparent',
                fontSize: '0.75rem',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="checkbox"
                checked={selectedShops.includes(shop.key)}
                onChange={() => toggleShop(shop.key)}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span style={{ 
                color: selectedShops.includes(shop.key) ? 'var(--text-primary)' : 'var(--text-muted)'
              }}>
                {shop.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Botón de migración */}
      <button
        className="btn"
        onClick={handleMigration}
        disabled={loading || selectedShops.length === 0}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="spinning" />
            Migrando {selectedShops.length} local(es)...
          </>
        ) : (
          <>
            <Play size={16} />
            Migrar {selectedShops.length} local(es)
          </>
        )}
      </button>

      {/* Resultado */}
      {result && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          borderRadius: 'var(--radius-sm)',
          background: result.success 
            ? 'rgba(16, 185, 129, 0.1)' 
            : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${result.success ? 'var(--success)' : 'var(--danger)'}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px'
        }}>
          {result.success ? (
            <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
          )}
          <div>
            <div style={{ 
              fontWeight: 500, 
              color: result.success ? 'var(--success)' : 'var(--danger)',
              fontSize: '0.85rem'
            }}>
              {result.message}
            </div>
            {result.success && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {result.orders} órdenes · {result.products} productos · {result.sessions} sesiones
              </div>
            )}
          </div>
        </div>
      )}

      <p style={{ 
        marginTop: '12px', 
        fontSize: '0.7rem', 
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        💡 Tip: Migrá pocos locales a la vez para evitar timeout
      </p>
    </div>
  )
}
