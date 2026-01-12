import { useState } from 'react'
import { User, Mail, Phone, Save, Loader2, CheckCircle } from 'lucide-react'
import type { User as AuthUser } from '@supabase/supabase-js'
import type { UserProfile } from '../../types/database'

interface ProfileSectionProps {
  user: AuthUser
  profile: UserProfile | null
  onUpdate: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error: string | null }>
}

export function ProfileSection({ user, profile, onUpdate }: ProfileSectionProps) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const result = await onUpdate({
      full_name: fullName || null,
      phone: phone || null,
    })

    setSaving(false)
    
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError(result.error || 'Error al guardar')
    }
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="section-icon">
          <User size={24} />
        </div>
        <div>
          <h1>Mi Perfil</h1>
          <p>Gestioná tu información personal</p>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-avatar-large">
          {(fullName || user.email || 'U').charAt(0).toUpperCase()}
        </div>
        
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label>
              <Mail size={16} />
              Email
            </label>
            <input
              type="email"
              value={user.email || ''}
              disabled
              className="input-disabled"
            />
            <span className="input-hint">El email no se puede modificar</span>
          </div>

          <div className="form-group">
            <label>
              <User size={16} />
              Nombre completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre y apellido"
            />
          </div>

          <div className="form-group">
            <label>
              <Phone size={16} />
              Teléfono
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 11 1234-5678"
            />
          </div>

          {profile?.assigned_shops && profile.assigned_shops.length > 0 && (
            <div className="form-group">
              <label>Tiendas asignadas</label>
              <div className="assigned-shops">
                {profile.assigned_shops.map(shop => (
                  <span key={shop} className="shop-badge">{shop}</span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="spinning" />
                Guardando...
              </>
            ) : saved ? (
              <>
                <CheckCircle size={18} />
                Guardado!
              </>
            ) : (
              <>
                <Save size={18} />
                Guardar cambios
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
