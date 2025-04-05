import { Purchases, Package } from '@revenuecat/purchases-js';
import { createClient } from './supabase';

let purchasesInstance: Purchases | null = null;

// Initialize RevenueCat when auth state changes
createClient().auth.onAuthStateChange(async (event, session) => {
  if (typeof window === 'undefined') return;

  const userId = session?.user?.id;
  
  if (userId) {
    // User logged in
    Purchases.configure(
      process.env.NEXT_PUBLIC_REVENUECAT_KEY!,
      userId
    );

    // If this is a new sign-up, create their profile
    if (event === 'SIGNED_IN') {
      await initializeUserProfile(userId, session.user.email);
    }
  } else {
    // Anonymous user
    Purchases.configure(
      process.env.NEXT_PUBLIC_REVENUECAT_KEY!,
      'anonymous' // Required appUserId parameter
    );
  }
});

// Initialize new user profile with free plan
async function initializeUserProfile(userId: string, email: string | undefined) {
  const { data: existingProfile } = await createClient()
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!existingProfile) {
    // Profile creation is now handled by the database trigger
    // This function exists as a backup only
    console.log('Profile creation handled by database trigger');
  }
}

// Helper functions for subscription management
export async function getCurrentSubscriptionStatus() {
  try {
    if (!purchasesInstance) {
      throw new Error("RevenueCat not initialized");
    }
    
    const customerInfo = await Purchases.getCustomerInfo();
    
    // Sync with Supabase if user is logged in
    const { data: { user } } = await createClient().auth.getUser();
    
    if (user?.id) {
      // Get current profile to preserve trial_used status
      const { data: profile } = await createClient()
        .from('private.profiles')
        .select('subscription_status')
        .eq('id', user.id)
        .single();

      // Use the secure function to update subscription status
      const { error } = await createClient()
        .rpc('update_subscription_status', {
          user_id: user.id,
          new_status: {
            ...customerInfo.entitlements.active,
            trial_used: profile?.subscription_status?.trial_used || false,
            updated_at: new Date().toISOString()
          }
        });

      if (error) {
        console.error('Error updating subscription status:', error);
      }
    }

    return customerInfo;
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    throw error;
  }
}

export async function purchasePackage(pkg: Package) {
  try {
    if (!purchasesInstance) {
      throw new Error("RevenueCat not initialized");
    }
        const { customerInfo } = await Purchases.purchasePackage(pkg);
    
    // Sync with Supabase after successful purchase
    await getCurrentSubscriptionStatus();
    
    return customerInfo;
  } catch (error) {
    console.error('Error purchasing package:', error);
    throw error;
  }
}

export async function getOfferings() {
  try {
    if (!purchasesInstance) {
      throw new Error("RevenueCat not initialized");
    }
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    throw error;
  }
}

// Get the Purchases instance
export function getInstance() {
  if (!purchasesInstance) {
    throw new Error("RevenueCat not initialized");
  }
  return purchasesInstance;
}

export default Purchases; 