import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TIER_LIMITS } from '@/lib/polar';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });
  
  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res;
  }

  // Get user's subscription info
  const { data: user } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status, subscription_end_date')
    .eq('id', session.user.id)
    .single();

  if (!user) {
    return res;
  }

  // Check if this is a recording request
  if (request.nextUrl.pathname === '/api/record') {
    // Get user's recording count for this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('memos')
      .select('id', { count: 'exact' })
      .eq('user_id', session.user.id)
      .gte('created_at', startOfMonth.toISOString());

    // Check if user has exceeded their limit
    if (user.subscription_tier === 'free' && count >= TIER_LIMITS.free.maxRecordings) {
      return new NextResponse(
        JSON.stringify({
          error: 'Free tier limit reached. Please upgrade to Pro for unlimited recordings.'
        }),
        { status: 403 }
      );
    }
  }

  // Add subscription info to request headers for use in API routes
  res.headers.set('x-subscription-tier', user.subscription_tier);
  res.headers.set('x-subscription-status', user.subscription_status);
  
  return res;
} 