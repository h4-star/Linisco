import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { UserProfile, UserRole } from '../types/database'

interface UserRoleState {
  profile: UserProfile | null
  role: UserRole | null
  loading: boolean
  error: string | null
  isAdmin: boolean
  isManager: boolean
  isEmployee: boolean
}

const ADMIN_EMAIL = 'h4subway@gmail.com'

export function useUserRole(userId: string | undefined) {
  const [state, setState] = useState<UserRoleState>({
    profile: null,
    role: null,
    loading: true,
    error: null,
    isAdmin: false,
    isManager: false,
    isEmployee: false,
  })

  useEffect(() => {
    if (!userId) {
      setState(prev => ({ ...prev, loading: false }))
      return
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (error) {
          // Si no existe el perfil, crearlo
          if (error.code === 'PGRST116') {
            const { data: userData } = await supabase.auth.getUser()
            const email = userData?.user?.email || ''
            const isAdminUser = email === ADMIN_EMAIL
            
            const newProfile: Partial<UserProfile> = {
              id: userId,
              email: email,
              role: isAdminUser ? 'admin' : 'employee',
              assigned_shops: [],
              is_active: true,
            }
            
            const { data: createdProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert(newProfile)
              .select()
              .single()

            if (createError) {
              console.error('Error creating profile:', createError)
              // Fallback: determinar rol por email
              const role: UserRole = isAdminUser ? 'admin' : 'employee'
              setState({
                profile: null,
                role,
                loading: false,
                error: null,
                isAdmin: role === 'admin',
                isManager: role === 'manager',
                isEmployee: role === 'employee',
              })
              return
            }

            setState({
              profile: createdProfile,
              role: createdProfile.role,
              loading: false,
              error: null,
              isAdmin: createdProfile.role === 'admin',
              isManager: createdProfile.role === 'manager',
              isEmployee: createdProfile.role === 'employee',
            })
            return
          }

          throw error
        }

        setState({
          profile: data,
          role: data.role,
          loading: false,
          error: null,
          isAdmin: data.role === 'admin',
          isManager: data.role === 'manager',
          isEmployee: data.role === 'employee',
        })
      } catch (err: any) {
        console.error('Error fetching profile:', err)
        // Fallback por email para determinar rol
        const { data: userData } = await supabase.auth.getUser()
        const email = userData?.user?.email || ''
        const isAdminUser = email === ADMIN_EMAIL
        const role: UserRole = isAdminUser ? 'admin' : 'employee'
        
        setState({
          profile: null,
          role,
          loading: false,
          error: err.message,
          isAdmin: role === 'admin',
          isManager: role === 'manager',
          isEmployee: role === 'employee',
        })
      }
    }

    fetchProfile()
  }, [userId])

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userId) return { success: false, error: 'No user ID' }
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      setState(prev => ({
        ...prev,
        profile: data,
      }))

      return { success: true, error: null }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  return {
    ...state,
    updateProfile,
  }
}
