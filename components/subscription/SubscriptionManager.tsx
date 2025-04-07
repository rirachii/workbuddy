'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useUserSubscription } from '@/lib/hooks/useUserSubscription'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatDate } from 'date-fns'
import { useSubscription } from '@/components/providers/subscription-provider'
import { CancelSubscriptionButton } from './CancelSubscriptionButton'

export function SubscriptionManager() {
  const { subscriptionStatus } = useUserSubscription()
  const { switchPlan } = useSubscription()
  const [isLoading, setIsLoading] = useState(false)

  const handlePlanSwitch = async (newPlan: 'monthly' | 'yearly') => {
    try {
      setIsLoading(true)
      await switchPlan(newPlan)
      toast.success(`Successfully switched to ${newPlan} plan!`)
    } catch (error) {
      console.error('Failed to switch plan:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to switch plan')
    } finally {
      setIsLoading(false)
    }
  }

  if (!subscriptionStatus?.active || subscriptionStatus.plan === 'free') {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-medium">Current Plan</h3>
        <p className="text-sm text-muted-foreground">
          You are currently on the {subscriptionStatus.plan} plan.
          {subscriptionStatus.expires_at && (
            <> Your subscription will renew on {formatDate(subscriptionStatus.expires_at, 'MMM d, yyyy')}.</>
          )}
        </p>
      </div>

      <div className="flex flex-col space-y-2">
        <h4 className="text-sm font-medium">Plan Management</h4>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => handlePlanSwitch(subscriptionStatus.plan === 'monthly' ? 'yearly' : 'monthly')}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Switch to {subscriptionStatus.plan === 'monthly' ? 'Yearly' : 'Monthly'} Plan
          </Button>
          <CancelSubscriptionButton disabled={isLoading} />
        </div>
      </div>
    </div>
  )
} 