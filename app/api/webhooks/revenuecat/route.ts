import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const REVENUECAT_WEBHOOK_AUTH_KEY = process.env.REVENUECAT_WEBHOOK_AUTH_KEY!

export async function POST(req: Request) {
  try {
    // Verify RevenueCat webhook authentication
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${REVENUECAT_WEBHOOK_AUTH_KEY}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const payload = await req.json()
    const event = payload.event
    const userId = payload.app_user_id
    
    // Skip if no user ID
    if (!userId) {
      console.error('No user ID in webhook payload:', payload)
      return new NextResponse('No user ID provided', { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key for private schema access
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Handle different event types
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'TRANSFER':
        // Active subscription
        const expirationDate = new Date(event.expires_at || Date.now() + (
          event.period_type === 'ANNUAL' 
            ? 365 * 24 * 60 * 60 * 1000  // 1 year
            : 30 * 24 * 60 * 60 * 1000   // 30 days
        ))

        await supabase.rpc('update_subscription_status', {
          user_id: userId,
          new_status: {
            plan: event.period_type === 'ANNUAL' ? 'yearly' : 'monthly',
            active: true,
            trial_used: event.is_trial_conversion || false,
            expires_at: expirationDate.toISOString(),
            updated_at: new Date().toISOString()
          }
        })
        break

      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'BILLING_ISSUE':
        // Subscription ended or failed
        await supabase.rpc('update_subscription_status', {
          user_id: userId,
          new_status: {
            plan: 'free',
            active: false,
            trial_used: true, // Keep trial used status
            updated_at: new Date().toISOString()
          }
        })
        break

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new NextResponse('Webhook processed', { status: 200 })
  } catch (error) {
    console.error('Error processing RevenueCat webhook:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// Only allow POST requests
export async function GET() {
  return new NextResponse('Method not allowed', { status: 405 });
} 