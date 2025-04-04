import {Purchases} from '@revenuecat/purchases-js';

// RevenueCat API key
const REVENUECAT_PUBLIC_SDK_KEY = process.env.NEXT_PUBLIC_REVENUECAT_KEY!;

// Subscription plan IDs
export const SUBSCRIPTION_PLANS = {
  monthly: 'ghosted_pro_monthly',
  yearly: 'ghosted_pro_yearly',
} as const;

// Plan features
export const PLAN_FEATURES = {
  free: [
    'Basic voice memos',
    'Limited transcriptions',
    'Basic AI analysis',
    '5 memos per month',
  ],
  pro: [
    'Unlimited voice memos',
    'Unlimited transcriptions',
    'Advanced AI analysis',
    'Priority support',
    'Calendar integration',
    'Export capabilities',
  ],
};

// Initialize RevenueCat
export const initializeRevenueCat = () => {
  if (!REVENUECAT_PUBLIC_SDK_KEY) {
    throw new Error('RevenueCat public key is not configured');
  }
  
  // Initialize with a random UUID as anonymous ID
  const anonymousId = crypto.randomUUID();
  Purchases.configure(REVENUECAT_PUBLIC_SDK_KEY, anonymousId);
};

// Types
export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

export type UserSubscriptionStatus = {
  isProMember: boolean;
  currentPlan: SubscriptionPlan | null;
  expiryDate: Date | null;
};

// Helper functions
export const formatPrice = (price: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(price);
}; 