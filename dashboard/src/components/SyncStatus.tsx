import { useState, useEffect } from 'react'
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface MigrationLog {
  id: number
  started_at: string
  finished_at: string | null
  status: string
  migration_type: string
  orders_migrated: number
  products_migrated: number
  error_message: string | null
}

interface SyncStatusData {
  lastMigration: MigrationLog | null
  totalMigrations: number
  successfulMigrations: number
  failedMigrations: number
  tablesExist: boolean
}

export function SyncStatus() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SyncStatusData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = async () => {
    setLoading(true)
    setError(null)

    try {
      // Verificar si la tabla existe y obtener datos
      const { data: logs, error: logsError } = await supabase
        .from('migration_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10)

      if (logsError) {
        if (logsError.message.includes('does not exist') || logsError.code === '42P01') {
          setData({
            lastMigration: null,
            totalMigrations: 0,
            successfulMigrations: 0,
            failedMigrations: 0,
            tablesExist: false
          })
          setError('Las tablas de migración no existen. Ejecutá cron-setup.sql en Supabase.')
          return
        }
        throw logsError
      }

      const allLogs = logs as MigrationLog[]
      
      setData({
        lastMigration: allLogs[0] || null,
        totalMigrations: allLogs.length,
        successfulMigrations: allLogs.filter(l => l.status === 'success').length,
        failedMigrations: allLogs.filter(l => l.status === 'error').length,
        tablesExist: true
      })

    } catch (err) {
      console.error('Error checking sync status:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && !data) {
      checkStatus()
    }
  }, [isOpen])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={14} style={{ color: 'var(--success)' }} />
      case 'error':
        return <XCircle size={14} style={{ color: 'var(--danger)' }} />
      case 'running':
        return <RefreshCw size={14} style={{ color: 'var(--warning)' }} className="spinning" />
      default:
        return <Clock size={14} style={{ color: 'var(--text-muted)' }} />
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
          left: '24px',
          zIndex: 1000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}
      >
        <Activity size={16} />
        Estado Sync
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      zIndex: 1000,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      width: '340px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)'
    }}>
      {/* Header */}
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
          <Activity size={18} style={{ color: 'var(--accent-primary)' }} />
          Estado de Sincronización
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

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <RefreshCw size={24} className="spinning" style={{ color: 'var(--accent-primary)' }} />
          <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>Verificando...</p>
        </div>
      ) : error ? (
        <div style={{
          padding: '16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, color: 'var(--danger)', fontWeight: 500 }}>
                Problema detectado
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {error}
              </p>
            </div>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Estado general */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              padding: '12px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>
                {data.successfulMigrations}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Exitosas</div>
            </div>
            <div style={{
              padding: '12px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                {data.failedMigrations}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fallidas</div>
            </div>
          </div>

          {/* Última migración */}
          {data.lastMigration ? (
            <div style={{
              padding: '12px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px'
              }}>
                {getStatusIcon(data.lastMigration.status)}
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                  Última migración
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  background: data.lastMigration.migration_type === 'scheduled' 
                    ? 'var(--accent-glow)' 
                    : 'rgba(139, 92, 246, 0.2)',
                  borderRadius: '4px',
                  color: data.lastMigration.migration_type === 'scheduled'
                    ? 'var(--accent-primary)'
                    : '#a78bfa'
                }}>
                  {data.lastMigration.migration_type === 'scheduled' ? 'CRON' : 'MANUAL'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                📅 {formatDate(data.lastMigration.started_at)}
              </div>
              {data.lastMigration.status === 'success' && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  📦 {data.lastMigration.orders_migrated} órdenes · {data.lastMigration.products_migrated} productos
                </div>
              )}
              {data.lastMigration.error_message && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--danger)', 
                  marginTop: '4px',
                  padding: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '4px'
                }}>
                  ❌ {data.lastMigration.error_message}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: '16px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--warning)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center'
            }}>
              <AlertTriangle size={24} style={{ color: 'var(--warning)' }} />
              <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--warning)' }}>
                No hay migraciones registradas
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                El cron job no está configurado o nunca se ejecutó
              </p>
            </div>
          )}
        </>
      ) : null}

      {/* Refresh button */}
      <button
        onClick={checkStatus}
        disabled={loading}
        className="btn btn-secondary"
        style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
      >
        <RefreshCw size={14} className={loading ? 'spinning' : ''} />
        Actualizar
      </button>

      <p style={{
        marginTop: '12px',
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        Si no ves migraciones automáticas, configurá el cron job en Supabase SQL Editor
      </p>
    </div>
  )
}

