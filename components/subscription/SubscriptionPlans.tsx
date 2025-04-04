'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";
import { PLAN_FEATURES, SUBSCRIPTION_PLANS } from '@/lib/revenuecat';
import { useSubscription } from '../providers/subscription-provider';
import { toast } from 'sonner';

export function SubscriptionPlans() {
  const { subscriptionStatus, purchaseSubscription, isLoading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [isPurchasing, setIsPurchasing] = useState(false);

  const prices = {
    monthly: 9.99,
    yearly: 99.99, // Save ~17%
  };

  const handlePurchase = async () => {
    if (!window.confirm('You will be redirected to complete your purchase. Continue?')) {
      return;
    }

    try {
      setIsPurchasing(true);
      await purchaseSubscription(SUBSCRIPTION_PLANS[selectedPlan]);
      toast.success('Successfully upgraded to Pro!');
    } catch (error) {
      console.error('Purchase error:', error);
      if (error instanceof Error && error.message.includes('cancelled')) {
        toast.error('Purchase cancelled');
      } else {
        toast.error('Failed to process purchase. Please try again.');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-4">Loading subscription details...</div>;
  }

  return (
    <div className="space-y-6">
      {!subscriptionStatus?.isProMember && (
        <div className="space-y-4">
          <div className="flex justify-center gap-4 p-4">
            <Button
              variant={selectedPlan === 'monthly' ? 'default' : 'outline'}
              onClick={() => setSelectedPlan('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={selectedPlan === 'yearly' ? 'default' : 'outline'}
              onClick={() => setSelectedPlan('yearly')}
            >
              Yearly (Save 17%)
            </Button>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold">Pro Plan</h3>
                <p className="text-muted-foreground">Unlock all features</p>
              </div>
              <Sparkles className="h-8 w-8 text-yellow-500" />
            </div>

            <div className="mb-6">
              <p className="text-3xl font-bold">
                ${selectedPlan === 'monthly' ? prices.monthly : prices.yearly}
                <span className="text-lg text-muted-foreground">
                  /{selectedPlan === 'monthly' ? 'month' : 'year'}
                </span>
              </p>
            </div>

            <ul className="space-y-2 mb-6">
              {PLAN_FEATURES.pro.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              size="lg"
              onClick={handlePurchase}
              disabled={isPurchasing}
            >
              {isPurchasing ? 'Processing...' : 'Upgrade to Pro'}
            </Button>
          </Card>
        </div>
      )}

      {subscriptionStatus?.isProMember && (
        <Card className="p-6 bg-gradient-to-r from-yellow-500/10 to-purple-500/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold">Pro Member</h3>
              <p className="text-muted-foreground">
                {subscriptionStatus?.currentPlan === 'yearly' ? 'Yearly' : 'Monthly'} Plan
              </p>
            </div>
            <Sparkles className="h-8 w-8 text-yellow-500" />
          </div>

          {subscriptionStatus?.expiryDate && (
            <p className="text-sm text-muted-foreground">
              Next billing date: {subscriptionStatus.expiryDate.toLocaleDateString()}
            </p>
          )}
        </Card>
      )}

      <div className="mt-6">
        <h4 className="font-medium mb-2">Free Plan Features</h4>
        <ul className="space-y-2">
          {PLAN_FEATURES.free.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 