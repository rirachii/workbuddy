'use client'

import { useState } from 'react'
import { Button, ButtonProps } from '@/components/ui/button'
import { useSubscription } from '@/components/providers/subscription-provider'
import { toast } from 'sonner'
import { AlertCircle, Loader2 } from 'lucide-react'
import { formatDate } from 'date-fns'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CancelSubscriptionButtonProps extends Omit<ButtonProps, 'onClick'> {
  children?: React.ReactNode;
  withConfirmation?: boolean;
}

export function CancelSubscriptionButton({ 
  children = "Cancel Subscription", 
  withConfirmation = true,
  ...buttonProps 
}: CancelSubscriptionButtonProps) {
  const { cancelSubscription, subscriptionStatus } = useSubscription()
  const [isLoading, setIsLoading] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const handleCancellation = async () => {
    try {
      setIsLoading(true)
      await cancelSubscription()
      // No need for success toast as user will be redirected to management portal
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to access subscription management')
      setIsLoading(false)
    }
  }

  const handleClick = () => {
    if (withConfirmation) {
      setShowCancelDialog(true)
    } else {
      handleCancellation()
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={handleClick}
        disabled={isLoading}
        {...buttonProps}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {children}
      </Button>

      {withConfirmation && (
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Cancel Subscription
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel your subscription? You'll lose access to premium features when your current billing period ends.
                {subscriptionStatus?.expiryDate && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <p className="font-medium">Your subscription will remain active until: {
                      formatDate(subscriptionStatus.expiryDate, 'MMM d, yyyy')
                    }</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleCancellation}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Continue to Cancel
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
