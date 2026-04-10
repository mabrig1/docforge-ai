'use client';

/**
 * CheckoutSection — handles currency selection and Flutterwave checkout.
 *
 * Flutterwave hosted checkout flow:
 *  1. User picks a currency.
 *  2. Button click → POST /api/orders/initiate → { paymentLink }.
 *  3. We redirect the browser to paymentLink (Flutterwave's hosted page).
 *  4. After payment, Flutterwave redirects to /payment/callback?tx_ref=...
 *     AND fires the webhook to the backend simultaneously.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { initiateOrder } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const CURRENCIES = [
  { code: 'NGN', label: '₦ NGN' },
  { code: 'USD', label: '$ USD' },
  { code: 'GBP', label: '£ GBP' },
  { code: 'EUR', label: '€ EUR' },
];

export default function CheckoutSection({ product }) {
  const { user } = useAuth();
  const router = useRouter();
  const [currency, setCurrency] = useState('NGN');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const { pricing, _id: productId } = product;

  // Only show currencies that have a price set
  const available = CURRENCIES.filter(({ code }) => pricing?.[code.toLowerCase()] != null);
  const amount    = pricing?.[currency.toLowerCase()];

  async function handleCheckout() {
    if (!user) {
      router.push(`/login?redirect=/products/${product.slug}`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { paymentLink } = await initiateOrder(productId, currency);
      // Hard redirect to Flutterwave hosted payment page
      window.location.href = paymentLink;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  if (!available.length) {
    return <p className="text-gray-500 text-sm">Pricing not yet available.</p>;
  }

  return (
    <div className="card space-y-4">
      {/* Currency selector */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
          Select Currency
        </label>
        <div className="flex flex-wrap gap-2">
          {available.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setCurrency(code)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition
                ${currency === code
                  ? 'bg-brand-600 border-brand-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Price display */}
      {amount != null && (
        <p className="text-3xl font-extrabold text-brand-400">
          {formatCurrency(amount, currency)}
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleCheckout}
        disabled={loading || amount == null}
        className="btn-primary w-full text-base py-3"
      >
        {loading ? 'Redirecting to payment…' : user ? 'Buy Now' : 'Login to Purchase'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Secured by Flutterwave · Instant download after payment
      </p>
    </div>
  );
}
