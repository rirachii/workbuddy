import {Purchases} from '@revenuecat/purchases-js';

// RevenueCat API key
const REVENUECAT_PUBLIC_SDK_KEY = process.env.NEXT_PUBLIC_REVENUECAT_KEY!;

// Subscription plan IDs
export const SUBSCRIPTION_PLANS = {
  monthly: "pro_monthly",
  yearly: "pro_yearly",
} as const;

// Plan features
export const PLAN_FEATURES = {
  free: [
    "Up to 50 voice memos",
    "10-minute maximum recording duration",
    "Basic AI analysis of recordings",
    "Basic voice memo organization",
    "Simple todo task management",
  ],
  pro: [
    "Unlimited voice memos",
    "Extended recording duration (up to 1 hour)",
    "Advanced AI analysis and insights",
    "Calendar integration for job search tracking",
    "Export capabilities (PDF, Audio formats)",
    "Priority support",
  ]
};

let isInitialized = false;

// Initialize RevenueCat
export const initializeRevenueCat = (userId?: string) => {
  if (!REVENUECAT_PUBLIC_SDK_KEY) {
    console.error('RevenueCat public key is not configured');
    throw new Error('RevenueCat public key is not configured');
  }
  
  // Skip initialization in SSR context
  if (typeof window === 'undefined') {
    console.log('Skipping RevenueCat initialization in server context');
    return null;
  }
  
  try {
    // Only initialize once and only with a valid user ID
    if (!isInitialized) {
      if (userId) {
        console.log('Initializing RevenueCat with user ID:', userId);
        
        // Check if we're in a real browser environment
        if (typeof window !== 'undefined' && window.navigator) {
          Purchases.configure(REVENUECAT_PUBLIC_SDK_KEY, userId);
          isInitialized = true;
        } else {
          console.log('Browser environment not available, skipping RevenueCat initialization');
          return null;
        }
      } else {
        console.log('Waiting for user ID before initializing RevenueCat');
        return null;
      }
    } else {
      // If already initialized, get the shared instance
      console.log('RevenueCat already initialized');
      return Purchases.getSharedInstance();
    }
    
    return Purchases.getSharedInstance();
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
    // Don't throw here - we want to gracefully degrade if RevenueCat fails
    return null;
  }
};

// Types
export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

export type UserSubscriptionStatus = {
  isProMember: boolean;
  currentPlan: SubscriptionPlan | null;
  expiryDate: Date | null;
  isCancelled?: boolean;
  managementURL?: string | null;
  pendingDowngradePlan?: SubscriptionPlan | 'free' | null;
};

// Helper functions
export const formatPrice = (price: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(price);
}; 