import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/supabase-auth-provider'
import { useSupabase } from '@/components/providers/supabase-provider'
import { useSubscription } from '@/components/providers/subscription-provider'

export type SubscriptionStatus = {
  plan: 'free' | 'monthly' | 'yearly'
  active: boolean
  trial_used: boolean
  expires_at?: string
  updated_at: string
}

export function useUserSubscription() {
  const { user } = useAuth()
  const { supabase } = useSupabase()
  const { purchaseSubscription } = useSubscription()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch subscription status
  useEffect(() => {
    async function fetchSubscriptionStatus() {
      if (!user?.id) {
        setSubscriptionStatus(null)
        setIsLoading(false)
        return
      }

      try {
        // Use RPC function to get subscription status
        const { data, error } = await supabase
          .rpc('get_user_subscription_status', {
            user_id: user.id
          })

        if (error) throw error

        setSubscriptionStatus(data as SubscriptionStatus | null)
      } catch (error) {
        console.error('Error fetching subscription:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscriptionStatus()
  }, [user?.id, supabase])

  // Switch subscription plan
  const switchPlan = async (newPlan: 'monthly' | 'yearly') => {
    if (!user) {
      throw new Error('Must be logged in to switch plans')
    }

    await purchaseSubscription(
      newPlan === 'yearly' ? 'ghosted_pro_yearly' : 'ghosted_pro_monthly'
    )
  }

  return {
    subscriptionStatus,
    isLoading,
    isSubscribed: subscriptionStatus?.active && subscriptionStatus?.plan !== 'free',
    currentPlan: subscriptionStatus?.plan || 'free',
    switchPlan,
  }
} 