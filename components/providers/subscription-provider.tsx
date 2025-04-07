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
  refreshSubscriptionStatus: () => Promise<void>;
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
          
          // Check if we have cached subscription data in sessionStorage
          const cachedData = sessionStorage.getItem(`subscription_${user.id}`);
          if (cachedData) {
            try {
              const parsed = JSON.parse(cachedData);
              console.log('Found cached subscription data:', parsed);
              // Convert expiry date string back to Date object if it exists
              if (parsed.expiryDate) {
                parsed.expiryDate = new Date(parsed.expiryDate);
              }
              setSubscriptionStatus(parsed);
            } catch (e) {
              console.error('Error parsing cached subscription data:', e);
            }
          }
          
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

      // Enhanced logic to determine the plan type from active subscriptions
      let currentPlan: SubscriptionPlan | null = null;
      const activeSubscriptions = Array.from(customerInfo.activeSubscriptions || []);
      
      console.log('Detected active subscriptions:', activeSubscriptions);
      
      if (activeSubscriptions.length > 0) {
        // Try various ways to identify yearly plan
        for (const subscription of activeSubscriptions) {
          console.log('Checking subscription:', subscription);
          
          // More comprehensive check for yearly identifiers
          if (
            subscription.toLowerCase().includes('yearly') ||
            subscription.toLowerCase().includes('annual') ||
            subscription.toLowerCase().includes('year') ||
            subscription.includes('ghosted_pro_yearly')
          ) {
            console.log('Identified as yearly plan:', subscription);
            currentPlan = 'yearly';
            break;
          } else if (
            subscription.toLowerCase().includes('monthly') ||
            subscription.toLowerCase().includes('month') ||
            subscription.includes('ghosted_pro_monthly')
          ) {
            console.log('Identified as monthly plan:', subscription);
            currentPlan = 'monthly';
            // Don't break here, continue checking in case there's a yearly subscription too
          }
        }
        
        // If we still couldn't determine, use the first subscription as fallback
        if (!currentPlan && activeSubscriptions.length > 0) {
          const fallbackPlan = activeSubscriptions[0];
          console.log('Using fallback plan determination:', fallbackPlan);
          currentPlan = fallbackPlan.includes('year') ? 'yearly' : 'monthly';
        }
      }

      console.log('Final subscription determination:', {
        isProMember: hasActiveSubscription,
        currentPlan,
        expiryDate
      });

      const newStatus = {
        isProMember: hasActiveSubscription,
        currentPlan,
        expiryDate,
      };
      
      setSubscriptionStatus(newStatus);
      
      // Cache the subscription status in sessionStorage
      if (user?.id) {
        try {
          // Need to convert Date to string for JSON serialization
          const cacheData = {
            ...newStatus,
            expiryDate: expiryDate ? expiryDate.toISOString() : null
          };
          sessionStorage.setItem(`subscription_${user.id}`, JSON.stringify(cacheData));
          console.log('Cached subscription data:', cacheData);
        } catch (e) {
          console.error('Error caching subscription data:', e);
        }
      }
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      toast.error('Failed to check subscription status');
    } finally {
      setIsLoading(false);
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
      const purchaseResult = await Purchases.getSharedInstance().purchase({
        rcPackage: targetPackage,
      });
      
      console.log('Purchase result:', purchaseResult);
      
      // Immediately update the UI with new subscription data
      const currentPlan = productId === SUBSCRIPTION_PLANS.yearly ? 'yearly' : 'monthly';
      
      setSubscriptionStatus({
        isProMember: true,
        currentPlan: currentPlan,
        expiryDate: purchaseResult.customerInfo.latestExpirationDate ? 
          new Date(purchaseResult.customerInfo.latestExpirationDate) : null
      });
      
      // Also refresh subscription status for completeness
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
      const purchaseResult = await Purchases.getSharedInstance().purchase({
        rcPackage: targetPackage,
      });
      
      console.log('Purchase result:', purchaseResult);
      
      // Force a refresh of the local state
      setSubscriptionStatus({
        isProMember: true,
        currentPlan: newPlan,
        expiryDate: purchaseResult.customerInfo.latestExpirationDate ? 
          new Date(purchaseResult.customerInfo.latestExpirationDate) : null
      });
      
      // Also refresh subscription status to make sure everything is in sync
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

  // Public method to force refresh subscription status
  const refreshSubscriptionStatus = async () => {
    if (!user) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Forcefully fetch fresh data from RevenueCat
      await Purchases.getSharedInstance().restorePurchases();
      await checkSubscriptionStatus();
      console.log('Subscription status refreshed');
    } catch (error) {
      console.error('Failed to refresh subscription status:', error);
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
        refreshSubscriptionStatus,
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