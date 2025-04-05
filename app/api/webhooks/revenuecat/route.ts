import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const REVENUECAT_WEBHOOK_AUTH_KEY = process.env.REVENUECAT_WEBHOOK_AUTH_KEY!
const isDevelopment = process.env.NODE_ENV === 'development'

export async function POST(req: Request) {
  try {
    // Clone the request to read the body for logging
    const reqForLogging = req.clone()
    
    // Log relevant request information
    const requestBody = await reqForLogging.text()
    console.log('Webhook request details:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      body: requestBody.length > 1000 ? requestBody.substring(0, 1000) + '...' : requestBody
    })
    
    // Parse the body as JSON for later use
    const payload = JSON.parse(requestBody)
    const event = payload.event
    let userId = event.app_user_id
    
    // Verify RevenueCat webhook authentication - check multiple possible header locations
    const authHeader = req.headers.get('Authorization') || 
      req.headers.get('authorization') || 
      req.headers.get('AUTHORIZATION')
    
    const vercelProxySignature = req.headers.get('x-vercel-proxy-signature')
    const vercelProxySignatureTs = req.headers.get('x-vercel-proxy-signature-ts')
    
    // Detailed logging for debugging auth issues
    console.log('Auth details:', {
      standardAuthHeader: {
        present: !!authHeader,
        prefixCorrect: authHeader?.startsWith('Bearer '),
        length: authHeader?.length
      },
      vercelProxy: {
        signaturePresent: !!vercelProxySignature,
        signaturePrefixCorrect: vercelProxySignature?.startsWith('Bearer '),
        timestampPresent: !!vercelProxySignatureTs,
        signature: vercelProxySignature?.substring(0, 15) + '...',
      },
      envVar: {
        present: !!REVENUECAT_WEBHOOK_AUTH_KEY,
        length: REVENUECAT_WEBHOOK_AUTH_KEY?.length
      }
    })

    // More flexible auth check for development
    if (isDevelopment) {
      console.warn('Development mode - proceeding with webhook processing')
    } else {
      // Production auth check - verify either standard auth header or Vercel proxy signature
      const isStandardAuthValid = authHeader === `Bearer ${REVENUECAT_WEBHOOK_AUTH_KEY}`
      const isProxyAuthValid = vercelProxySignature === `Bearer ${REVENUECAT_WEBHOOK_AUTH_KEY}`
      
      if (!isStandardAuthValid && !isProxyAuthValid) {
        console.error('Webhook authentication failed:', {
          standardAuthPresent: !!authHeader,
          proxyAuthPresent: !!vercelProxySignature,
          standardAuthPrefix: authHeader?.substring(0, 10),
          proxyAuthPrefix: vercelProxySignature?.substring(0, 10)
        })
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    // Skip if no user ID
    if (!userId) {
      console.error('No user ID in webhook payload')
      return new NextResponse('No user ID provided', { status: 400 })
    }

    // Check if this is an anonymous ID (which we don't expect)
    if (userId.startsWith('$RCAnonymousID:')) {
      console.log('Unexpected anonymous ID received:', userId);
      console.log('Full webhook payload:', JSON.stringify(payload, null, 2));
      
      // Either reject the webhook
      return new NextResponse('Anonymous IDs not supported', { status: 400 });
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

    // Special handling for test events
    if (event.type === 'TEST') {
      console.log('Processing TEST event');
      
      // For test events, we'll update with a temporary subscription
      // This is useful for testing the webhook flow in sandbox mode
      try {
        await supabase.rpc('private.update_subscription_status', {
          user_id: userId,
          new_status: {
            plan: 'monthly', // Default to monthly for test events
            active: true,
            trial_used: false,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            updated_at: new Date().toISOString()
          }
        });
        console.log('Successfully updated subscription status for TEST event');
      } catch (error) {
        console.error('Failed to update subscription for TEST event:', error);
      }
      
      return new NextResponse('Test event processed', { status: 200 });
    }
    
    // Handle different event types for real purchases
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

        try {
          const result = await supabase.rpc('private.update_subscription_status', {
            user_id: userId,
            new_status: {
              plan: event.period_type === 'ANNUAL' ? 'yearly' : 'monthly',
              active: true,
              trial_used: event.is_trial_conversion || false,
              expires_at: expirationDate.toISOString(),
              updated_at: new Date().toISOString()
            }
          });
          
          if (result.error) {
            throw result.error;
          }
          
          console.log('Successfully updated subscription status to active', {
            userId,
            plan: event.period_type === 'ANNUAL' ? 'yearly' : 'monthly',
            expiresAt: expirationDate.toISOString()
          });
        } catch (error) {
          console.error('Failed to update subscription status:', error);
          throw error; // Re-throw to be caught by the outer try/catch
        }
        break

      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'BILLING_ISSUE':
        // Subscription ended or failed
        try {
          const result = await supabase.rpc('private.update_subscription_status', {
            user_id: userId,
            new_status: {
              plan: 'free',
              active: false,
              trial_used: true, // Keep trial used status
              updated_at: new Date().toISOString()
            }
          });
          
          if (result.error) {
            throw result.error;
          }
          
          console.log('Successfully updated subscription status to inactive', {
            userId,
            reason: event.type
          });
        } catch (error) {
          console.error('Failed to update subscription status:', error);
          throw error; // Re-throw to be caught by the outer try/catch
        }
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