import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    // Obtener sesión actual
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          setState(prev => ({ ...prev, loading: false, error: error.message }))
          return
        }

        setState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null
        })
      } catch (err) {
        console.error('Session error:', err)
        setState(prev => ({ ...prev, loading: false }))
      }
    }

    getSession()

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event)
        setState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null
        })
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: error.message === 'Invalid login credentials' 
            ? 'Email o contraseña incorrectos'
            : error.message
        }))
        return { success: false, error }
      }

      setState({
        user: data.user,
        session: data.session,
        loading: false,
        error: null
      })

      return { success: true, error: null }
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Error de conexión. Intentá de nuevo.'
      }))
      return { success: false, error: err }
    }
  }

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      await supabase.auth.signOut()
      setState({
        user: null,
        session: null,
        loading: false,
        error: null
      })
    } catch (err) {
      console.error('Sign out error:', err)
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.session,
    signIn,
    signOut
  }
}

