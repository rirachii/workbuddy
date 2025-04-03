'use client';

import { useUser } from '@/components/providers/supabase-provider';
import { useEffect, useState } from 'react';
import { Purchases, Package } from '@revenuecat/purchases-js';
import { Database } from '@/types/supabase';
import { createClient } from '@/lib/supabase';

type Subscription = Database['public']['Tables']['user_subscriptions']['Row'];

type Plan = {
  identifier: string;
  title: string;
  description: string;
  price: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    identifier: 'free',
    title: 'Free',
    description: 'Basic features for personal use',
    price: '$0',
    features: [
      '10 voice memos per month',
      'Basic transcription',
      'Standard support',
    ],
  },
  {
    identifier: 'pro_monthly',
    title: 'Pro Monthly',
    description: 'Advanced features for professionals',
    price: '$9.99/month',
    features: [
      'Unlimited voice memos',
      'Advanced AI transcription',
      'Priority support',
      'Custom categories',
      'Export options',
    ],
  },
  {
    identifier: 'pro_yearly',
    title: 'Pro Yearly',
    description: 'Best value for long-term use',
    price: '$99.99/year',
    features: [
      'All Pro Monthly features',
      '2 months free',
      'Early access to new features',
      'Team collaboration tools',
    ],
  },
];

export default function SubscriptionPlans() {
  const user = useUser();
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function initializeRevenueCat() {
      try {
        await Purchases.configure(process.env.NEXT_PUBLIC_REVENUECAT_KEY!, user.id);
        const customerInfo = await Purchases.getCustomerInfo();
        console.log('RevenueCat Customer Info:', customerInfo);
      } catch (error) {
        console.error('Error initializing RevenueCat:', error);
        setError('Failed to initialize subscription service');
      }
    }

    async function loadSubscription() {
      try {
        const { data, error } = await createClient()
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setCurrentSubscription(data);
      } catch (error) {
        console.error('Error loading subscription:', error);
        setError('Failed to load subscription status');
      } finally {
        setLoading(false);
      }
    }

    initializeRevenueCat();
    loadSubscription();
  }, [user]);

  async function handleSubscribe(plan: Plan) {
    if (!user) return;

    try {
      setError(null);
      const offerings = await Purchases.getOfferings();
      
      if (!offerings.current) throw new Error('No offerings available');

      const selectedPackage = offerings.current.packages.find(
        (pkg: Package) => pkg.identifier === plan.identifier
      );

      if (!selectedPackage) throw new Error('Selected plan not available');

      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      console.log('Purchase successful:', customerInfo);

      // Subscription status will be updated via webhook
    } catch (error) {
      console.error('Error subscribing:', error);
      setError('Failed to process subscription');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {PLANS.map((plan) => (
        <div
          key={plan.identifier}
          className="bg-white rounded-lg shadow-lg p-6 flex flex-col"
        >
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">{plan.title}</h3>
            <p className="mt-2 text-gray-500">{plan.description}</p>
            <p className="mt-4 text-3xl font-bold text-gray-900">{plan.price}</p>
            <ul className="mt-6 space-y-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start">
                  <svg
                    className="h-6 w-6 text-green-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="ml-3 text-gray-500">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => handleSubscribe(plan)}
            disabled={currentSubscription?.status === 'active' && plan.identifier === 'free'}
            className={`mt-8 w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
              ${
                currentSubscription?.status === 'active' && plan.identifier === 'free'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
          >
            {currentSubscription?.status === 'active' && plan.identifier === 'free'
              ? 'Current Plan'
              : 'Subscribe'}
          </button>
        </div>
      ))}
    </div>
  );
} 