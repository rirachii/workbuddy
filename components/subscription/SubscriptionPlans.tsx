'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";
import { PLAN_FEATURES, SUBSCRIPTION_PLANS } from '@/lib/revenuecat';
import { useSubscription } from '../providers/subscription-provider';
import { toast } from 'sonner';
import { CancelSubscriptionButton } from './CancelSubscriptionButton';

export function SubscriptionPlans() {
  const { subscriptionStatus, purchaseSubscription, switchPlan, isLoading } = useSubscription();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const prices = {
    monthly: 9.99,
    yearly: 99.99, // Save ~17%
  };

  const handlePurchase = async (plan: 'monthly' | 'yearly') => {
    if (!window.confirm(`You will be redirected to complete your purchase of the ${plan} plan. Continue?`)) {
      return;
    }

    try {
      setIsPurchasing(true);
      await purchaseSubscription(SUBSCRIPTION_PLANS[plan]);
      toast.success(`Successfully subscribed to Pro ${plan} plan!`);
    } catch (error) {
      console.error('Purchase error:', error);
      if (error instanceof Error && error.message.includes('cancelled')) {
        toast.info('Purchase cancelled');
      } else {
        toast.error('Failed to process purchase. Please try again.');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleUpgradeToYearly = async () => {
    if (!window.confirm('You will be upgrading from Monthly to Yearly billing. Continue?')) {
      return;
    }

    try {
      setIsUpgrading(true);
      await switchPlan('yearly');
      toast.success('Successfully upgraded to yearly plan!');
    } catch (error) {
      console.error('Upgrade error:', error);
      if (error instanceof Error && error.message.includes('cancelled')) {
        toast.info('Upgrade cancelled');
      } else {
        toast.error('Failed to upgrade. Please try again.');
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-4">Loading subscription details...</div>;
  }

  // Free Plan (No subscription)
  if (!subscriptionStatus?.isProMember) {
    return (
      <div className="space-y-6">
        <Card className="p-6 border-dashed">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold">Free Plan</h3>
              <p className="text-muted-foreground">Current Plan</p>
            </div>
          </div>

          <ul className="space-y-2 mb-6">
            {PLAN_FEATURES.free.map((feature, index) => (
              <li key={index} className="flex items-center gap-2">
                <Check className="h-5 w-5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Monthly Pro Plan Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">Pro Monthly</h3>
                <p className="text-muted-foreground">Unlock all features</p>
              </div>
              <Sparkles className="h-6 w-6 text-yellow-500" />
            </div>

            <div className="mb-6">
              <p className="text-2xl font-bold">
                ${prices.monthly}
                <span className="text-lg text-muted-foreground">/month</span>
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => handlePurchase('monthly')}
              disabled={isPurchasing}
            >
              {isPurchasing ? 'Processing...' : 'Subscribe Monthly'}
            </Button>
          </Card>

          {/* Yearly Pro Plan Card */}
          <Card className="p-6 border-2 border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold">Pro Yearly</h3>
                <p className="text-muted-foreground">Best value</p>
              </div>
              <Sparkles className="h-6 w-6 text-yellow-500" />
            </div>

            <div className="mb-6">
              <p className="text-2xl font-bold">
                ${prices.yearly}
                <span className="text-lg text-muted-foreground">/year</span>
              </p>
              <p className="text-sm text-green-600 font-medium">Save ~17% compared to monthly</p>
            </div>

            <Button
              className="w-full"
              variant="default"
              onClick={() => handlePurchase('yearly')}
              disabled={isPurchasing}
            >
              {isPurchasing ? 'Processing...' : 'Subscribe Yearly'}
            </Button>
          </Card>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Pro features include:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            {PLAN_FEATURES.pro.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Monthly Pro Subscription
  if (subscriptionStatus.isProMember && subscriptionStatus.currentPlan === 'monthly') {
    return (
      <div className="space-y-6">
        <Card className="p-6 bg-gradient-to-r from-yellow-500/10 to-purple-500/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-2xl font-bold">Pro Monthly</h3>
              <p className="text-muted-foreground">Current Plan</p>
            </div>
            <Sparkles className="h-8 w-8 text-yellow-500" />
          </div>

          {subscriptionStatus?.expiryDate && (
            <p className="text-sm text-muted-foreground mb-6">
              Next billing date: {subscriptionStatus.expiryDate.toLocaleDateString()}
            </p>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Button
              variant="outline"
              onClick={handleUpgradeToYearly}
              disabled={isUpgrading}
              className="w-full"
            >
              {isUpgrading ? 'Processing...' : 'Upgrade to Yearly'}
            </Button>
            
            <CancelSubscriptionButton 
              variant="outline"
              className="w-full"
            >
              Cancel Subscription
            </CancelSubscriptionButton>
          </div>
        </Card>

        {/* Yearly upgrade info */}
        <Card className="p-4 border-dashed">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <h3 className="font-medium">Upgrade to Yearly</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            Switch to our yearly plan and save ~17% compared to monthly billing.
          </p>
          <p className="font-medium">
            ${prices.yearly}/year (${(prices.yearly / 12).toFixed(2)}/month equivalent)
          </p>
        </Card>

        <div className="text-sm text-muted-foreground">
          <p>Your Pro plan includes:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            {PLAN_FEATURES.pro.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Yearly Pro Subscription (can only cancel, no downgrade option)
  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-yellow-500/10 to-purple-500/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold">Pro Yearly</h3>
            <p className="text-muted-foreground">Current Plan</p>
          </div>
          <Sparkles className="h-8 w-8 text-yellow-500" />
        </div>

        {subscriptionStatus?.expiryDate && (
          <p className="text-sm text-muted-foreground mb-6">
            Next billing date: {subscriptionStatus.expiryDate.toLocaleDateString()}
          </p>
        )}
        
        <div className="mt-4">
          <CancelSubscriptionButton 
            variant="outline"
            className="w-full"
          >
            Cancel Subscription
          </CancelSubscriptionButton>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>Your Pro plan includes:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          {PLAN_FEATURES.pro.map((feature, index) => (
            <li key={index}>{feature}</li>
          ))}
        </ul>
      </div>
    </div>
  );
} 