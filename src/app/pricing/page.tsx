import { polarClient } from '@/lib/polar';
import { Metadata } from 'next';
import Link from 'next/link';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'Pricing - AI Voice Memo',
  description: 'Choose the perfect plan for your voice memo needs'
};

export default async function PricingPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  
  const { result } = await polarClient.products.list({
    isArchived: false
  });

  const proProduct = result.items.find(p => p.name === 'Pro');

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:flex-col sm:align-center">
        <h1 className="text-5xl font-extrabold text-gray-900 sm:text-center">
          Pricing Plans
        </h1>
        <p className="mt-5 text-xl text-gray-500 sm:text-center">
          Start with our free tier or upgrade to Pro for more memos
        </p>
      </div>
      
      <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
        {/* Free Tier */}
        <div className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
          <div className="p-6">
            <h2 className="text-2xl font-medium leading-6 text-gray-900">Free</h2>
            <p className="mt-4 text-sm text-gray-500">Perfect for trying out voice memos</p>
            <p className="mt-8">
              <span className="text-4xl font-extrabold text-gray-900">$0</span>
              <span className="text-base font-medium text-gray-500">/mo</span>
            </p>
            {!session ? (
              <Link
                href="/login"
                className="mt-8 block w-full bg-gray-800 border border-gray-800 rounded-md py-2 text-sm font-semibold text-white text-center hover:bg-gray-900"
              >
                Get Started
              </Link>
            ) : (
              <button
                disabled
                className="mt-8 block w-full bg-gray-400 border border-gray-400 rounded-md py-2 text-sm font-semibold text-white text-center cursor-not-allowed"
              >
                Current Plan
              </button>
            )}
          </div>
          <div className="pt-6 pb-8 px-6">
            <h3 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
              What's included
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              <li className="flex space-x-3">
                <span className="text-sm text-gray-500">2 voice memos per month</span>
              </li>
              <li className="flex space-x-3">
                <span className="text-sm text-gray-500">Up to 10 minutes per recording</span>
              </li>
              <li className="flex space-x-3">
                <span className="text-sm text-gray-500">7-day retention</span>
              </li>
              <li className="flex space-x-3">
                <span className="text-sm text-gray-500">Basic AI processing</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Pro Tier */}
        <div className="border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-200">
          <div className="p-6">
            <h2 className="text-2xl font-medium leading-6 text-gray-900">Pro</h2>
            <p className="mt-4 text-sm text-gray-500">For regular voice memo users</p>
            <p className="mt-8">
              <span className="text-4xl font-extrabold text-gray-900">$9.99</span>
              <span className="text-base font-medium text-gray-500">/mo</span>
            </p>
            {!session ? (
              <Link
                href="/login"
                className="mt-8 block w-full bg-indigo-600 border border-transparent rounded-md py-2 text-sm font-semibold text-white text-center hover:bg-indigo-700"
              >
                Sign up for Pro
              </Link>
            ) : proProduct ? (
              <Link
                href={`/api/checkout?productId=${proProduct.id}`}
                className="mt-8 block w-full bg-indigo-600 border border-transparent rounded-md py-2 text-sm font-semibold text-white text-center hover:bg-indigo-700"
              >
                Upgrade to Pro
              </Link>
            ) : (
              <button
                disabled
                className="mt-8 block w-full bg-gray-400 border border-gray-400 rounded-md py-2 text-sm font-semibold text-white text-center cursor-not-allowed"
              >
                Pro Plan Unavailable
              </button>
            )}
          </div>
          <div className="pt-6 pb-8 px-6">
            <h3 className="text-xs font-medium text-gray-900 tracking-wide uppercase">
              What's included
            </h3>
            <ul role="list" className="mt-6 space-y-4">
              <li className="flex space-x-3">
                <span className="text-sm text-gray-500">20 voice memos per month</span>
              </li>
              <li className="flex space-x-3">
                <span className="text-sm text-gray-500">Up to 1 hour per recording</span>
              </li>
              <li className="flex space-x-3">
                <span className="text-sm text-gray-500">Unlimited retention</span>
              </li>
              <li className="flex space-x-3">
                <span className="text-sm text-gray-500">Advanced AI processing</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 