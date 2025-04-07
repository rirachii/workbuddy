'use client';

import { useState, useEffect } from 'react';
import { useSubscription } from '@/components/providers/subscription-provider';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CalendarClock } from 'lucide-react';
import { formatDate } from 'date-fns';

export function SubscriptionExpiry() {
  const { subscriptionStatus } = useSubscription();
  const [countdown, setCountdown] = useState<{ days: number; hours: number; } | null>(null);

  // Calculate the time remaining until subscription expires
  useEffect(() => {
    if (!subscriptionStatus?.expiryDate) return;

    // Function to calculate time remaining
    const calculateTimeRemaining = () => {
      const now = new Date();
      const expiryDate = subscriptionStatus.expiryDate as Date;

      // If already expired, don't show countdown
      if (now >= expiryDate) {
        setCountdown(null);
        return;
      }

      // Calculate days, hours, minutes
      const totalMilliseconds = expiryDate.getTime() - now.getTime();
      const totalSeconds = Math.floor(totalMilliseconds / 1000);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalMinutes / 60);
      
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      
      setCountdown({ days, hours });
    };

    // Calculate initially
    calculateTimeRemaining();
    
    // Update every minute
    const intervalId = setInterval(calculateTimeRemaining, 60000);
    
    // Cleanup
    return () => clearInterval(intervalId);
  }, [subscriptionStatus?.expiryDate]);
  
  // If not Pro member or no expiry date, don't show
  if (!subscriptionStatus?.isProMember || !subscriptionStatus?.expiryDate) {
    return null;
  }
  
  // Only show for cancelled subscriptions
  // If we weren't able to detect cancellation state, make a best guess
  if (subscriptionStatus.isCancelled === false) {
    return null;
  }
  
  // Format the expiry date
  const formattedDate = subscriptionStatus.expiryDate 
    ? formatDate(subscriptionStatus.expiryDate, 'MMMM d, yyyy')
    : 'Unknown';
    
  const formattedTime = subscriptionStatus.expiryDate
    ? formatDate(subscriptionStatus.expiryDate, 'h:mm a')
    : '';

  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-orange-500 mt-1 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="font-medium text-orange-800 dark:text-orange-300">Subscription Cancelled</h4>
            
            <p className="text-sm text-orange-700 dark:text-orange-400">
              Your subscription has been cancelled but will remain active until <span className="font-semibold">{formattedDate}</span> at {formattedTime}.
            </p>
            
            {countdown && (
              <div className="flex items-center mt-2 text-sm">
                <CalendarClock className="h-4 w-4 mr-1 text-orange-600 dark:text-orange-400" />
                <span className="text-orange-700 dark:text-orange-400">
                  Time remaining: 
                  <span className="font-semibold px-1">
                    {countdown.days} {countdown.days === 1 ? 'day' : 'days'}, 
                    {countdown.hours} {countdown.hours === 1 ? 'hour' : 'hours'}, 
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
