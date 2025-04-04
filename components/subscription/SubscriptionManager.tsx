'use client'

import { useState } from 'react'
import { useUserSubscription } from '@/lib/hooks/useUserSubscription'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

export function SubscriptionManager() {
  const { 
    subscriptionStatus, 
    isLoading, 
    currentPlan,
    switchPlan,
    cancelSubscription 
  } = useUserSubscription()
  const [isUpdating, setIsUpdating] = useState(false)

  if (isLoading) {
    return <div>Loading subscription details...</div>
  }

  const handlePlanSwitch = async (newPlan: 'monthly' | 'yearly') => {
    try {
      setIsUpdating(true)
      await switchPlan(newPlan)
      toast.success(`Successfully switched to ${newPlan} plan`)
    } catch (error) {
      console.error('Failed to switch plan:', error)
      toast.error('Failed to switch plan. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancellation = async () => {
    try {
      setIsUpdating(true)
      await cancelSubscription()
      // No need for success toast as user will be redirected to management portal
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      toast.error('Failed to access subscription management. Please try again.')
      setIsUpdating(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Subscription Management</CardTitle>
        <CardDescription>
          Manage your subscription plan and billing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Current Plan</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {currentPlan} {subscriptionStatus?.active ? '(Active)' : '(Inactive)'}
            </p>
            {subscriptionStatus?.expires_at && (
              <p className="text-sm text-muted-foreground">
                Expires: {new Date(subscriptionStatus.expires_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {subscriptionStatus?.active && currentPlan !== 'free' && (
            <div>
              <h3 className="font-medium mb-2">Switch Plan</h3>
              <div className="flex gap-4">
                <Button
                  variant={currentPlan === 'monthly' ? 'secondary' : 'outline'}
                  onClick={() => handlePlanSwitch('monthly')}
                  disabled={isUpdating || currentPlan === 'monthly'}
                >
                  Switch to Monthly
                </Button>
                <Button
                  variant={currentPlan === 'yearly' ? 'secondary' : 'outline'}
                  onClick={() => handlePlanSwitch('yearly')}
                  disabled={isUpdating || currentPlan === 'yearly'}
                >
                  Switch to Yearly
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        {subscriptionStatus?.active && currentPlan !== 'free' && (
          <Button
            variant="destructive"
            onClick={handleCancellation}
            disabled={isUpdating}
          >
            Cancel Subscription
          </Button>
        )}
      </CardFooter>
    </Card>
  )
} 