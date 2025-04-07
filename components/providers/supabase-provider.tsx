'use client'

import { createContext, useContext, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/supabase/types'

const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      storageKey: 'ghosted-auth',
      storage: {
        getItem: (key) => {
          if (typeof window === 'undefined') return null
          return window.localStorage.getItem(key)
        },
        setItem: (key, value) => {
          if (typeof window === 'undefined') return
          window.localStorage.setItem(key, value)
        },
        removeItem: (key) => {
          if (typeof window === 'undefined') return
          window.localStorage.removeItem(key)
        },
      },
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)

interface SupabaseContextType {
  supabase: ReturnType<typeof createBrowserClient<Database>>
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
} 