import { useState, type FormEvent } from 'react'
import { Lock, Mail, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error: any }>
  error: string | null
  loading: boolean
}

export function LoginPage({ onLogin, error, loading }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) return
    
    setIsSubmitting(true)
    await onLogin(email, password)
    setIsSubmitting(false)
  }

  const isLoading = loading || isSubmitting

  return (
    <div className="login-container">
      {/* Fondo animado */}
      <div className="login-background">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>

      <div className="login-card">
        {/* Logo */}
        <div className="login-header">
          <div className="login-logo">
            <div className="login-logo-icon">
              <span>L</span>
            </div>
            <div className="login-logo-text">
              <h1>Linisco</h1>
              <span>Dashboard de Ventas</span>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">
              <Mail size={16} />
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <Lock size={16} />
              Contraseña
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading || !email || !password}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="spinning" />
                Ingresando...
              </>
            ) : (
              <>
                <Lock size={18} />
                Ingresar
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p>Sistema de gestión para locales Subway y Daniel</p>
        </div>
      </div>

      {/* Decoración */}
      <div className="login-shops">
        <span className="shop-badge subway">Subway</span>
        <span className="shop-badge daniel">Daniel</span>
        <span className="shop-badge seitu">Seitu</span>
      </div>
    </div>
  )
}

