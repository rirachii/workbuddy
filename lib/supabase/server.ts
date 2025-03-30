import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from './types'
import { headers } from 'next/headers'

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
  
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          // This is a server component, so we can't set cookies directly
          // They will be set by the client-side auth
        },
        remove(name: string, options: any) {
          // This is a server component, so we can't remove cookies directly
          // They will be removed by the client-side auth
        }
      },
    }
  )
}

// Helper function to get authenticated user from request
export async function getAuthenticatedUser() {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) {
        console.error('Token auth error:', error);
        // Fall through to cookie auth
      } else if (user) {
        return user;
      }
    }
    
    // Try cookie-based auth
    const supabase = await getSupabaseServerClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Cookie auth error:', error);
      throw error;
    }
    
    if (!session?.user) {
      throw new Error('No valid session found');
    }
    
    return session.user;
  } catch (error) {
    console.error('getAuthenticatedUser error:', error);
    throw new Error('Unauthorized - Please sign in');
  }
} 