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
        const { data, error } = await supabase
          .from('private.user_subscriptions')
          .select('subscription_status')
          .eq('id', user.id)
          .single()

        if (error) throw error

        setSubscriptionStatus(data?.subscription_status || null)
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

    // Use RevenueCat to handle the actual subscription change
    await purchaseSubscription(
      newPlan === 'yearly' ? 'ghosted_pro_yearly' : 'ghosted_pro_monthly'
    )
  }

  // Cancel subscription (downgrade to free)
  const cancelSubscription = async () => {
    if (!user) {
      throw new Error('Must be logged in to cancel subscription')
    }

    // This will redirect to RevenueCat's customer portal for cancellation
    const { data: customerInfo } = await supabase
      .from('private.user_subscriptions')
      .select('subscription_status')
      .eq('id', user.id)
      .single()

    if (customerInfo?.subscription_status?.managementUrl) {
      window.location.href = customerInfo.subscription_status.managementUrl
    } else {
      throw new Error('No management URL available')
    }
  }

  return {
    subscriptionStatus,
    isLoading,
    isSubscribed: subscriptionStatus?.active && subscriptionStatus?.plan !== 'free',
    currentPlan: subscriptionStatus?.plan || 'free',
    switchPlan,
    cancelSubscription,
  }
} 