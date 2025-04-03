import { Webhooks } from "@polar-sh/nextjs";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    switch (payload.type) {
      case 'subscription.active':
        // Update user's subscription status to pro
        await supabase
          .from('users')
          .update({
            subscription_tier: 'pro',
            subscription_id: payload.data.id,
            subscription_status: 'active',
            subscription_end_date: payload.data.currentPeriodEnd
          })
          .eq('id', payload.data.userId);
        break;

      case 'subscription.revoked':
        // Downgrade to free tier
        await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_id: null,
            subscription_status: 'inactive',
            subscription_end_date: null
          })
          .eq('id', payload.data.userId);
        
        // Optional: Clean up old memos beyond free retention period
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        await supabase
          .from('memos')
          .delete()
          .eq('user_id', payload.data.userId)
          .lt('created_at', sevenDaysAgo.toISOString());
        break;

      case 'subscription.canceled':
        // Mark subscription as canceled but don't revoke access yet
        await supabase
          .from('users')
          .update({
            subscription_status: 'canceled',
            subscription_end_date: payload.data.currentPeriodEnd
          })
          .eq('id', payload.data.userId);
        break;
    }
  }
}); 