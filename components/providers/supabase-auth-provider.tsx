'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { useSupabase } from './supabase-provider'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { supabase } = useSupabase()

  // Handle auth errors and session recovery
  const handleAuthError = async (error: any) => {
    console.error('Auth error:', error)
    
    // If it's a refresh token error, try to recover the session
    if (error.message?.includes('refresh token') || error.code === 'refresh_token_not_found') {
      try {
        // Try to get a new session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        
        if (session) {
          setUser(session.user)
          return true // Recovered successfully
        }
      } catch (recoveryError) {
        console.error('Failed to recover session:', recoveryError)
      }
    }
    
    // If we couldn't recover, sign out
    await handleSignOut()
    return false
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      router.refresh()
      router.push('/')
    } catch (error) {
      console.error('Error during sign out:', error)
    }
  }

  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          const recovered = await handleAuthError(error)
          if (!recovered) return
        }
        setUser(session?.user ?? null)
      } catch (error) {
        await handleAuthError(error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully')
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        router.refresh()
        router.push('/')
      } else if (session) {
        setUser(session.user)
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  const signOut = async () => {
    await handleSignOut()
  }

  const value = {
    user,
    isLoading,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 