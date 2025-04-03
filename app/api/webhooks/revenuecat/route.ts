import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// RevenueCat webhook types
type RevenueCatEvent = {
  event: {
    type: string;
    subscriber: {
      original_app_user_id: string;
      subscriptions: {
        [key: string]: {
          period_type: string;
          purchased_at: string;
          expires_at: string;
          store: string;
          is_sandbox: boolean;
        }
      };
      entitlements: {
        [key: string]: {
          expires_date: string | null;
          product_identifier: string;
        }
      };
    };
  };
};

// Verify RevenueCat webhook signature
function verifyRevenueCatSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

export async function POST(req: Request) {
  try {
    const headersList = headers();
    const signature = headersList.get('x-revenuecat-signature');

    // Verify webhook signature
    if (!signature || !process.env.REVENUECAT_WEBHOOK_SECRET) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.text();
    const isValid = verifyRevenueCatSignature(
      body,
      signature,
      process.env.REVENUECAT_WEBHOOK_SECRET
    );

    if (!isValid) {
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body) as RevenueCatEvent;
    const userId = event.event.subscriber.original_app_user_id;
    
    // Get the first subscription (usually there's only one)
    const subscription = Object.values(event.event.subscriber.subscriptions)[0];
    const entitlement = Object.values(event.event.subscriber.entitlements)[0];

    // Determine subscription status
    const now = new Date();
    const expiresAt = new Date(subscription.expires_at);
    const isActive = expiresAt > now;

    // Get current subscription to check trial status
    const { data: currentSub } = await supabase
      .from('private.user_subscriptions')
      .select('subscription_status')
      .eq('id', userId)
      .single();

    // Update subscription status
    await supabase.rpc('update_subscription_status', {
      user_id: userId,
      new_status: {
        plan: entitlement?.product_identifier || 'free',
        active: isActive,
        trial_used: currentSub?.subscription_status?.trial_used || subscription.period_type === 'TRIAL',
        expires_at: subscription.expires_at,
        updated_at: new Date().toISOString()
      }
    });

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('RevenueCat webhook error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Only allow POST requests
export async function GET() {
  return new NextResponse('Method not allowed', { status: 405 });
} 