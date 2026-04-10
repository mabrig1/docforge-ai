'use client';

/**
 * CheckoutSection — currency + provider selection, then payment redirect.
 *
 * Provider capabilities:
 *   Flutterwave: NGN, USD, GBP, EUR  (card, USSD, bank transfer)
 *   Paystack:    NGN, USD, GBP       (card, bank transfer, USSD)
 *
 * Flow:
 *  1. Buyer picks a currency.
 *  2. Buyer picks a payment provider (both shown when currency is supported
 *     by both; only Flutterwave shown for EUR).
 *  3. Button click → POST /api/orders/initiate/<provider>
 *  4. Browser hard-redirects to the hosted payment page.
 *  5. After payment, provider redirects to /payment/callback?provider=<name>&...
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { initiateFlutterwaveOrder, initiatePaystackOrder } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const CURRENCIES = [
  { code: 'NGN', symbol: '₦', label: 'NGN' },
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'GBP', symbol: '£', label: 'GBP' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
];

// Paystack only supports these three
const PAYSTACK_SUPPORTED = new Set(['NGN', 'USD', 'GBP']);

const PROVIDERS = [
  {
    id:      'paystack',
    name:    'Paystack',
    logo:    '🟢',
    tagline: 'Card · Bank Transfer · USSD',
    color:   'emerald',
  },
  {
    id:      'flutterwave',
    name:    'Flutterwave',
    logo:    '🟠',
    tagline: 'Card · USSD · Bank Transfer',
    color:   'orange',
  },
];

export default function CheckoutSection({ product }) {
  const { user }  = useAuth();
  const router    = useRouter();

  // Default provider to Paystack for NGN/USD/GBP, Flutterwave for EUR
  const [currency, setCurrency]   = useState('NGN');
  const [provider, setProvider]   = useState('paystack');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const { pricing, _id: productId } = product;

  // Only show currencies that have a price set
  const available = CURRENCIES.filter(({ code }) => pricing?.[code.toLowerCase()] != null);
  const amount    = pricing?.[currency.toLowerCase()];

  // When currency changes, ensure selected provider still supports it
  function handleCurrencyChange(code) {
    setCurrency(code);
    if (!PAYSTACK_SUPPORTED.has(code)) setProvider('flutterwave');
    else setProvider((p) => p); // keep existing choice
  }

  // Providers available for the selected currency
  const availableProviders = PROVIDERS.filter(
    (p) => p.id === 'flutterwave' || PAYSTACK_SUPPORTED.has(currency)
  );

  async function handleCheckout() {
    if (!user) {
      router.push(`/login?redirect=/products/${product.slug}`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const initiate = provider === 'paystack'
        ? initiatePaystackOrder
        : initiateFlutterwaveOrder;

      const { paymentLink } = await initiate(productId, currency);
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
    <div className="card space-y-5">
      {/* Currency selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
          Currency
        </label>
        <div className="flex flex-wrap gap-2">
          {available.map(({ code, symbol, label }) => (
            <button
              key={code}
              onClick={() => handleCurrencyChange(code)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition
                ${currency === code
                  ? 'bg-brand-600 border-brand-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
            >
              {symbol} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      {amount != null && (
        <p className="text-3xl font-extrabold text-brand-400">
          {formatCurrency(amount, currency)}
        </p>
      )}

      {/* Provider selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
          Pay with
        </label>
        <div className="flex gap-3">
          {availableProviders.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`flex-1 flex flex-col items-center gap-1 rounded-xl border py-3 px-2
                          text-sm transition
                ${provider === p.id
                  ? 'border-brand-500 bg-brand-900/30 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'}`}
            >
              <span className="text-2xl leading-none">{p.logo}</span>
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs text-gray-500 text-center leading-tight">{p.tagline}</span>
            </button>
          ))}
        </div>

        {/* EUR-only notice */}
        {currency === 'EUR' && (
          <p className="mt-2 text-xs text-amber-400">
            EUR payments are processed via Flutterwave only.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleCheckout}
        disabled={loading || amount == null}
        className="btn-primary w-full text-base py-3"
      >
        {loading
          ? 'Redirecting…'
          : user
            ? `Pay with ${provider === 'paystack' ? 'Paystack' : 'Flutterwave'}`
            : 'Login to Purchase'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Secured by {provider === 'paystack' ? 'Paystack' : 'Flutterwave'} · Instant download after payment
      </p>
    </div>
  );
}
