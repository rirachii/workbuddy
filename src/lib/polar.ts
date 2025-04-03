import { Polar } from '@polar-sh/sdk'

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: 'production'
})

// Subscription tier definitions
export const TIER_LIMITS = {
  free: {
    maxRecordings: 2,
    maxDuration: 600, // 10 minutes in seconds
    retentionDays: 7
  },
  pro: {
    maxRecordings: 20,
    maxDuration: 3600, // 1 hour in seconds
    retentionDays: Infinity
  }
};

// Helper to check if user can record based on their tier and usage
export async function canUserRecord(userId: string): Promise<boolean> {
  const subscriptions = await polarClient.subscriptions.list({
    userId: userId
  });
  
  const isProUser = subscriptions.some(sub => 
    sub.status === 'active' && sub.productId === process.env.POLAR_PRO_PRODUCT_ID
  );
  
  // Get user's recording count for this month
  const userRecordingCount = await getUserRecordingCount(userId);
  
  // Check against the appropriate tier limit
  const limit = isProUser ? TIER_LIMITS.pro.maxRecordings : TIER_LIMITS.free.maxRecordings;
  return userRecordingCount < limit;
}

// Helper to get max duration based on tier
export function getMaxDuration(tier: 'free' | 'pro'): number {
  return TIER_LIMITS[tier].maxDuration;
}

// Helper to get retention days based on tier
export function getRetentionDays(tier: 'free' | 'pro'): number {
  return TIER_LIMITS[tier].retentionDays;
} 