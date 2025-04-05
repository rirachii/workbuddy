// supabase/functions/revenuecat-webhook/index.ts
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const REVENUECAT_WEBHOOK_AUTH_KEY = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
serve(async (req)=>{
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405
    });
  }
  try {
    // Log detailed request information for debugging
    console.log('Received webhook request:', {
      headers: Object.fromEntries(req.headers.entries()),
      method: req.method,
      url: req.url
    });
    
    // Verify RevenueCat webhook authentication
    const authHeader = req.headers.get('Authorization');
    
    // Log auth details (for debugging, remove in production)
    console.log('Auth details:', {
      headerPresent: !!authHeader,
      keyPresent: !!REVENUECAT_WEBHOOK_AUTH_KEY,
      headerPrefix: authHeader?.substring(0, 10),
      envVars: Object.keys(Deno.env.toObject())
    });
    // Direct comparison works here because no proxy is modifying the header
    if (authHeader !== `Bearer ${REVENUECAT_WEBHOOK_AUTH_KEY}`) {
      // For sandbox testing, you might want to bypass auth checks
      if (req.headers.get('user-agent')?.includes('RevenueCat') && Deno.env.get('ENVIRONMENT') === 'development') {
        console.log('Bypassing auth for development');
      } else {
        return new Response('Unauthorized', {
          status: 401
        });
      }
    }
    // Parse the webhook payload with error handling
    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      console.error('Failed to parse JSON payload:', e);
      return new Response('Invalid JSON payload', { status: 400 });
    }
    
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2));
    
    const event = payload.event;
    if (!event) {
      console.error('No event in webhook payload');
      return new Response('No event provided', { status: 400 });
    }
    
    const userId = event.app_user_id;
    // Skip if no user ID
    if (!userId) {
      console.error('No user ID in webhook payload');
      return new Response('No user ID provided', {
        status: 400
      });
    }
    // Check for anonymous ID
    if (userId.startsWith('$RCAnonymousID:')) {
      console.log('Anonymous ID not supported:', userId);
      return new Response('Anonymous IDs not supported', {
        status: 400
      });
    }
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Special handling for test events
    if (event.type === 'TEST') {
      console.log('Processing TEST event');
      // For test events, update with temporary subscription
      const { error } = await supabase.rpc('update_subscription_status', {
        user_id: userId,
        new_status: {
          plan: 'monthly',
          active: true,
          trial_used: false,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }
      });
      if (error) {
        console.error('Failed to update subscription for TEST event:', error);
        throw error;
      }
      console.log('Successfully updated subscription status for TEST event');
      return new Response('Test event processed', {
        status: 200
      });
    }
    // Handle different event types for real purchases
    switch(event.type){
      case 'INVOICE_ISSUANCE':
        console.log('Processing INVOICE_ISSUANCE event - preparing for payment');
        // For now, just acknowledge receipt without modifying subscription state
        // This is the event that occurs when an invoice is created but not yet paid
        return new Response('Invoice issuance acknowledged', {
          status: 200
        });
        
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'TRANSFER':
        // Log subscription information for debugging
        console.log('Processing subscription event:', {
          eventType: event.type,
          productId: event.product_id,
          allEventData: event
        });
        
        // Determine if yearly based on RevenueCat identifiers
        let isYearly = false;
        
        // Check the specific product_id field shown in the logs
        if (event.product_id && 
            (event.product_id === 'ghosted_pro_yearly' || 
             event.product_id.toLowerCase().includes('annual') || 
             event.product_id.toLowerCase().includes('year'))) {
          console.log('Detected yearly plan from product_id:', event.product_id);
          isYearly = true;
        }
        // Additional checks for other possible field locations
        else if (
          // Check package type
          (event.package_type && event.package_type === '$rc_annual') ||
          // Check identifier
          (event.identifier && event.identifier === '$rc_annual') ||
          // Check product identifier
          (event.product?.identifier && event.product.identifier === 'ghosted_pro_yearly') ||
          // Check billing product identifier
          (event.rcBillingProduct?.identifier && event.rcBillingProduct.identifier === 'ghosted_pro_yearly') ||
          (event.webBillingProduct?.identifier && event.webBillingProduct.identifier === 'ghosted_pro_yearly')
        ) {
          console.log('Detected yearly plan from other fields');
          isYearly = true;
        }
        
        const plan = isYearly ? 'yearly' : 'monthly';
        const expirationDate = new Date(event.expires_at || Date.now() + (isYearly ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000));
        
        // Check for trial period
        const isTrial = event.period_type === 'TRIAL';
        
        console.log('Determined plan type:', {
          isYearly,
          isTrial,
          plan,
          periodType: event.period_type,
          expirationDate: expirationDate.toISOString(),
          originalExpiration: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null
        });
        
        // For trial periods, we need to look for the end date or use a default trial period
        const actualExpirationDate = isTrial && event.expiration_at_ms 
          ? new Date(event.expiration_at_ms) 
          : expirationDate;
        
        const { error: activationError } = await supabase.rpc('update_subscription_status', {
          user_id: userId,
          new_status: {
            plan: plan,
            active: true,
            trial_used: event.is_trial_conversion || false,
            is_trial: isTrial,
            expires_at: actualExpirationDate.toISOString(),
            updated_at: new Date().toISOString()
          }
        });
        if (activationError) {
          console.error('Failed to update subscription status:', activationError);
          throw activationError;
        }
        console.log('Successfully updated subscription status to active', {
          userId,
          plan: event.period_type === 'ANNUAL' ? 'yearly' : 'monthly',
          expiresAt: expirationDate.toISOString()
        });
        break;
      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'BILLING_ISSUE':
        // Subscription ended or failed
        const { error: cancellationError } = await supabase.rpc('update_subscription_status', {
          user_id: userId,
          new_status: {
            plan: 'free',
            active: false,
            trial_used: true,
            updated_at: new Date().toISOString()
          }
        });
        if (cancellationError) {
          console.error('Failed to update subscription status:', cancellationError);
          throw cancellationError;
        }
        console.log('Successfully updated subscription status to inactive', {
          userId,
          reason: event.type
        });
        break;
      default:
        console.log('Unhandled event type:', event.type);
    }
    return new Response('Webhook processed', {
      status: 200
    });
  } catch (error) {
    console.error('Error processing RevenueCat webhook:', error);
    // Log detailed error information
    if (error instanceof Error) {
      console.error({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    return new Response('Internal Server Error: ' + (error instanceof Error ? error.message : String(error)), {
      status: 500
    });
  }
});
