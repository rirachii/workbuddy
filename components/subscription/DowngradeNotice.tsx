'use client';

import { useSubscription } from '@/components/providers/subscription-provider';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownToLine, CalendarClock } from 'lucide-react';
import { formatDate } from 'date-fns';

export function DowngradeNotice() {
  const { subscriptionStatus } = useSubscription();
  
  // If not a Pro member or no expiry date, don't show
  if (!subscriptionStatus?.isProMember || 
      !subscriptionStatus?.expiryDate || 
      !subscriptionStatus?.pendingDowngradePlan) {
    return null;
  }
  
  // Format the expiry date
  const formattedDate = formatDate(subscriptionStatus.expiryDate, 'MMMM d, yyyy');
  const formattedTime = formatDate(subscriptionStatus.expiryDate, 'h:mm a');
  
  // Determine the message based on downgrade type
  const planName = subscriptionStatus.pendingDowngradePlan === 'monthly'
    ? 'Monthly Pro'
    : subscriptionStatus.pendingDowngradePlan === 'free'
      ? 'Free'
      : 'new';

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <ArrowDownToLine className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="font-medium text-blue-800 dark:text-blue-300">Plan Change Scheduled</h4>
            
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Your subscription will change to the {planName} plan on <span className="font-semibold">{formattedDate}</span> at {formattedTime}.
            </p>
            
            <div className="flex items-center mt-2 text-sm">
              <CalendarClock className="h-4 w-4 mr-1 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-700 dark:text-blue-400">
                You'll continue to have access to your current plan until then.
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
