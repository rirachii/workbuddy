'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/supabase-auth-provider';
import { Purchases, Package, CustomerInfo, PurchasesError, ErrorCode } from '@revenuecat/purchases-js';
import { initializeRevenueCat, UserSubscriptionStatus, SubscriptionPlan } from '@/lib/revenuecat';
import { toast } from 'sonner';

type SubscriptionContextType = {
  isLoading: boolean;
  subscriptionStatus: UserSubscriptionStatus | null;
  purchaseSubscription: (productId: string) => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<UserSubscriptionStatus | null>(null);

  // Initialize RevenueCat once when the provider mounts
  useEffect(() => {
    try {
      initializeRevenueCat();
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      toast.error('Failed to initialize subscription service');
    }
  }, []);

  // Identify user when they log in
  useEffect(() => {
    const identifyUser = async () => {
      if (!user?.id) return;

      try {
        // Configure with user ID
        Purchases.configure(process.env.NEXT_PUBLIC_REVENUECAT_KEY!, user.id);
        await checkSubscriptionStatus();
      } catch (error) {
        console.error('Failed to identify user:', error);
        toast.error('Failed to load subscription status');
      }
    };

    identifyUser();
  }, [user?.id]);

  const checkSubscriptionStatus = async () => {
    try {
      const customerInfo = await Purchases.getSharedInstance().getCustomerInfo();
      
      // Check if user has active subscription
      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;
      
      // Get expiry date if subscription is active
      let expiryDate: Date | null = null;
      if (hasActiveSubscription) {
        const activeEntitlement = Object.values(customerInfo.entitlements.active)[0];
        if (activeEntitlement.expirationDate) {
          expiryDate = new Date(activeEntitlement.expirationDate);
        }
      }

      // Determine the plan type based on the active subscriptions
      let currentPlan: SubscriptionPlan | null = null;
      const activeSubscriptions = Array.from(customerInfo.activeSubscriptions || []);
      if (activeSubscriptions.length > 0) {
        const activeSubscription = activeSubscriptions[0];
        currentPlan = activeSubscription.includes('yearly') ? 'yearly' : 'monthly';
      }

      setSubscriptionStatus({
        isProMember: hasActiveSubscription,
        currentPlan,
        expiryDate,
      });
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      toast.error('Failed to check subscription status');
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseSubscription = async (productId: string) => {
    try {
      setIsLoading(true);
      
      // Get available offerings
      const offerings = await Purchases.getSharedInstance().getOfferings();
      if (!offerings.current) {
        throw new Error('No offerings available');
      }

      // Find the package with matching product ID
      const targetPackage = offerings.current.availablePackages.find(
        (pkg: Package) => pkg.webBillingProduct.identifier === productId
      );

      if (!targetPackage) {
        throw new Error('Selected subscription package not found');
      }

      // Purchase the package
      await Purchases.getSharedInstance().purchase({
        rcPackage: targetPackage,
      });
      
      // Refresh subscription status
      await checkSubscriptionStatus();
      
      toast.success('Subscription purchased successfully!');
    } catch (error) {
      if (error instanceof PurchasesError && error.errorCode === ErrorCode.UserCancelledError) {
        toast.info('Purchase cancelled');
      } else {
        console.error('Failed to purchase subscription:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to purchase subscription');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isLoading,
        subscriptionStatus,
        purchaseSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
} 