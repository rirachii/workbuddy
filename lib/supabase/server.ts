import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from './types'
import { headers } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY')
}

// Create a Supabase client with the service role key for server-side operations
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Create a Supabase client with the user's session cookie
export async function getSupabaseServerClient() {
  const cookieStore = cookies()
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        }
      }
    }
  )
}

// Helper function to get authenticated user from request
export async function getAuthenticatedUser() {
  try {
    const supabase = await getSupabaseServerClient()
    const headersList = headers()

    // Check for Bearer token in Authorization header
    const authHeader = headersList.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (error) {
        console.error('Token authentication error:', error)
        throw error
      }
      if (user) {
        return user
      }
    }

    // Fall back to cookie-based authentication
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Cookie authentication error:', error)
      throw error
    }
    if (!session?.user) {
      throw new Error('No authenticated user found')
    }

    return session.user
  } catch (error) {
    console.error('Authentication error:', error)
    throw error
  }
} 