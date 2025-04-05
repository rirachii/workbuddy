'use client';

import { useUser } from '@/components/providers/supabase-provider';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SubscriptionPage() {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Upgrade Your Experience
          </h1>
          <p className="text-lg text-gray-600">
            Choose the plan that best fits your needs
          </p>
        </div>
        
        <SubscriptionPlans />
      </div>
    </div>
  );
} 