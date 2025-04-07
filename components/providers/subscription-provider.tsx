'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/supabase-auth-provider';
import { Purchases, Package, CustomerInfo, PurchasesError, ErrorCode } from '@revenuecat/purchases-js';
import { initializeRevenueCat, UserSubscriptionStatus, SubscriptionPlan, SUBSCRIPTION_PLANS } from '@/lib/revenuecat';
import { toast } from 'sonner';

type SubscriptionContextType = {
  isLoading: boolean;
  subscriptionStatus: UserSubscriptionStatus | null;
  purchaseSubscription: (productId: string) => Promise<void>;
  switchPlan: (newPlan: 'monthly' | 'yearly') => Promise<void>;
  getManagementUrl: () => Promise<string>;
  cancelSubscription: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<UserSubscriptionStatus | null>(null);

  // Initialize RevenueCat and handle user identification
  useEffect(() => {
    const setupRevenueCat = async () => {
      try {
        if (user?.id) {
          console.log('Setting up RevenueCat with user:', user.id);
          const purchases = initializeRevenueCat(user.id);
          if (purchases) {
            await checkSubscriptionStatus();
          }
        } else {
          console.log('User not logged in, waiting for user ID');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to setup RevenueCat:', error);
        toast.error('Failed to initialize subscription service');
        setIsLoading(false);
      }
    };

    setupRevenueCat();
  }, [user?.id]);

  const checkSubscriptionStatus = async () => {
    try {
      const customerInfo = await Purchases.getSharedInstance().getCustomerInfo();
      console.log('Customer info:', customerInfo);
      
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
    }
  };

  const purchaseSubscription = async (productId: string) => {
    if (!user) {
      toast.error('Please sign in to purchase a subscription');
      return;
    }

    try {
      setIsLoading(true);
      
      console.log('Attempting to purchase product:', productId);
      console.log('Expected product IDs:', SUBSCRIPTION_PLANS);
      
      // Get available offerings
      const offerings = await Purchases.getSharedInstance().getOfferings();
      console.log('Available offerings:', offerings);
      
      if (!offerings.current) {
        console.error('No offerings found. Full offerings object:', offerings);
        throw new Error('No subscription plans are currently available. Please try again later.');
      }

      console.log('Current offering packages:', offerings.current.availablePackages);

      // Find the package with matching product ID
      const targetPackage = offerings.current.availablePackages.find(
        (pkg: Package) => {
          console.log('Checking package:', pkg.webBillingProduct.identifier);
          return pkg.webBillingProduct.identifier === productId;
        }
      );

      if (!targetPackage) {
        console.error('Product ID not found in packages. Available packages:', 
          offerings.current.availablePackages.map(pkg => pkg.webBillingProduct.identifier)
        );
        throw new Error(`Subscription plan "${productId}" not found. Please try another plan.`);
      }

      // Purchase the package
      console.log('Purchasing package:', targetPackage);
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

  const switchPlan = async (newPlan: 'monthly' | 'yearly') => {
    if (!user) {
      toast.error('Please sign in to switch plans');
      return;
    }

    try {
      setIsLoading(true);
      
      // Validate plan switch - only allowing monthly to yearly, not vice versa
      if (subscriptionStatus?.currentPlan === 'yearly' && newPlan === 'monthly') {
        throw new Error('Downgrading from yearly to monthly is not supported. Please cancel your yearly subscription first if you wish to switch to monthly billing.');
      }
      
      // Get current subscription
      const customerInfo = await Purchases.getSharedInstance().getCustomerInfo();
      const activeSubscriptions = Array.from(customerInfo.activeSubscriptions || []);
      
      if (activeSubscriptions.length === 0) {
        throw new Error('No active subscription found');
      }

      console.log('Switching from', subscriptionStatus?.currentPlan, 'to', newPlan);
      console.log('Active subscriptions:', activeSubscriptions);

      // Get available offerings
      const offerings = await Purchases.getSharedInstance().getOfferings();
      if (!offerings.current) {
        throw new Error('No subscription plans are currently available');
      }

      // Find the package for the new plan
      const targetProductId = newPlan === 'yearly' ? 'ghosted_pro_yearly' : 'ghosted_pro_monthly';
      const targetPackage = offerings.current.availablePackages.find(
        (pkg: Package) => pkg.webBillingProduct.identifier === targetProductId
      );

      if (!targetPackage) {
        console.error('Target package not found:', {
          targetProductId,
          availablePackages: offerings.current.availablePackages.map(pkg => pkg.webBillingProduct.identifier)
        });
        throw new Error(`Plan "${targetProductId}" not found`);
      }

      // Switch to the new package
      await Purchases.getSharedInstance().purchase({
        rcPackage: targetPackage,
      });
      
      // Refresh subscription status
      await checkSubscriptionStatus();
      
      toast.success(`Successfully switched to ${newPlan} subscription plan!`);
    } catch (error) {
      if (error instanceof PurchasesError && error.errorCode === ErrorCode.UserCancelledError) {
        toast.info('Plan switch cancelled');
      } else {
        console.error('Failed to switch subscription plan:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to switch subscription plan');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getManagementUrl = async () => {
    try {
      const url = await Purchases.getSharedInstance().getCustomerInfo();
      const managementUrl = url.managementURL;
      if (!managementUrl) {
        throw new Error('Management URL not available');
      }
      return managementUrl;
    } catch (error) {
      console.error('Failed to get management URL:', error);
      throw new Error('Failed to get subscription management URL');
    }
  };

  const cancelSubscription = async () => {
    if (!user) {
      toast.error('Please sign in to cancel your subscription');
      return;
    }

    try {
      setIsLoading(true);
      
      // Get management URL and redirect user
      const managementUrl = await getManagementUrl();
      
      if (managementUrl) {
        window.location.href = managementUrl;
      } else {
        throw new Error('Unable to get subscription management URL');
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel subscription');
      throw error;
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
        switchPlan,
        getManagementUrl,
        cancelSubscription,
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