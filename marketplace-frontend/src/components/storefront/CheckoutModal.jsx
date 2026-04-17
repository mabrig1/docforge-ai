'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, X, PlayCircle,
  CreditCard, ShieldCheck, ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { initiateFlutterwaveOrder, initiatePaystackOrder, initiatePaypalOrder } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const PAYSTACK_CURRENCIES = new Set(['NGN', 'USD', 'GBP']);
const PAYPAL_CURRENCIES   = new Set(['USD', 'GBP', 'EUR']);

const CURRENCY_META = {
  NGN: { symbol: '₦' },
  USD: { symbol: '$' },
  GBP: { symbol: '£' },
  EUR: { symbol: '€' },
};

const COVER_GRADIENTS = [
  'from-slate-700 to-slate-900',
  'from-blue-700 to-blue-900',
  'from-emerald-700 to-emerald-900',
  'from-red-800 to-red-950',
  'from-purple-800 to-indigo-900',
];

function formatPrice(pricing, currency) {
  const amount = pricing?.[currency.toLowerCase()];
  if (amount == null) return null;
  const { symbol } = CURRENCY_META[currency] ?? { symbol: '' };
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: currency === 'NGN' ? 0 : 2,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  })}`;
}

/**
 * CheckoutModal
 *
 * @param {object}   props
 * @param {Product}  props.product   — product to purchase
 * @param {string}   props.currency  — currency selected in the storefront
 * @param {function} props.onClose   — called when modal should close
 */
export default function CheckoutModal({ product, currency: initialCurrency, onClose }) {
  const { user }  = useAuth();
  const router    = useRouter();

  const [currency, setCurrency]   = useState(initialCurrency);
  const [provider, setProvider]   = useState(
    PAYSTACK_CURRENCIES.has(initialCurrency) ? 'paystack' : 'flutterwave'
  );
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const { pricing, productType, trackList, _id: productId, title, creator } = product;

  // Available currencies for this product
  const availableCurrencies = Object.keys(CURRENCY_META)
    .filter((c) => pricing?.[c.toLowerCase()] != null);

  const priceStr = formatPrice(pricing, currency);

  function handleCurrencyChange(c) {
    setCurrency(c);
    if (!PAYSTACK_CURRENCIES.has(c)) setProvider('flutterwave');
  }

  const availableProviders = [
    { id: 'paystack',    name: 'Paystack',    desc: 'Card · Bank · USSD', emoji: '🟢' },
    { id: 'flutterwave', name: 'Flutterwave', desc: 'Card · USSD · Bank', emoji: '🟠' },
    { id: 'paypal',      name: 'PayPal',      desc: 'PayPal balance · Card', emoji: '🔵' },
  ].filter((p) => {
    if (p.id === 'paystack')   return PAYSTACK_CURRENCIES.has(currency);
    if (p.id === 'paypal')     return PAYPAL_CURRENCIES.has(currency);
    return true; // flutterwave always available
  });

  async function handlePay() {
    if (!user) {
      router.push(`/login?redirect=/products/${product.slug}`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const initiate = provider === 'paystack'  ? initiatePaystackOrder
                     : provider === 'paypal'    ? initiatePaypalOrder
                     : initiateFlutterwaveOrder;
      // PayPal defaults to USD if NGN is selected (NGN not supported)
      const effectiveCurrency = provider === 'paypal' && !PAYPAL_CURRENCIES.has(currency)
        ? 'USD' : currency;
      const { paymentLink } = await initiate(productId, effectiveCurrency);
      window.location.href = paymentLink;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50
                 flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg
                       flex flex-col max-h-[90vh] overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50
                         flex justify-between items-center shrink-0">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart size={20} className="text-slate-600" />
            Checkout
          </h2>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-800 transition-colors p-1 rounded-full hover:bg-gray-100">
            <X size={22} />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Order summary */}
          <div className="flex gap-4">
            <div className={`w-20 h-28 rounded-xl bg-gradient-to-br
                              ${COVER_GRADIENTS[0]} shrink-0 flex items-end p-2
                              overflow-hidden`}>
              {product.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.coverImageUrl} alt={title}
                  className="w-full h-full object-cover rounded-lg absolute inset-0" />
              ) : (
                <span className="text-white text-[9px] font-bold leading-tight text-center w-full">
                  {title}
                </span>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="font-bold text-lg leading-tight">{title}</h3>
              {creator && <p className="text-sm text-gray-400 mt-0.5">by {creator}</p>}
              <p className="text-xs text-gray-500 mt-1">
                {productType === 'book' ? 'Digital eBook (PDF/EPUB)' : 'Digital Audio (MP3 + ZIP)'}
              </p>
              <p className="font-extrabold text-2xl text-slate-900 mt-2">{priceStr}</p>
            </div>
          </div>

          {/* Track listing for audio */}
          {productType === 'audio' && trackList?.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-gray-700">
                <PlayCircle size={15} />
                Includes {trackList.length} Tracks
              </h4>
              <ol className="text-sm text-gray-600 space-y-1.5">
                {trackList.map((track, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-200 text-xs
                                     flex items-center justify-center shrink-0 text-gray-500">
                      {i + 1}
                    </span>
                    {track}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Currency selector */}
          {availableCurrencies.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <div className="flex flex-wrap gap-2">
                {availableCurrencies.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleCurrencyChange(c)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition
                      ${currency === c
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-gray-500'}`}
                  >
                    {CURRENCY_META[c].symbol} {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provider selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pay with
            </label>
            <div className="grid grid-cols-2 gap-3">
              {availableProviders.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl
                               border text-sm transition
                    ${provider === p.id
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-400'}`}
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-gray-400 text-center">{p.desc}</span>
                </button>
              ))}
            </div>
            {currency === 'EUR' && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <span>⚠️</span> EUR is available via Flutterwave or PayPal.
              </p>
            )}
            {currency === 'NGN' && provider === 'paypal' && (
              <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <span>⚠️</span> PayPal will charge in USD (NGN not supported by PayPal).
              </p>
            )}
          </div>

          {/* Auth note when logged out */}
          {!user && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
              You&apos;ll be asked to log in or create a free account before payment.
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100
                           rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}
        </div>

        {/* ── Footer / Pay button ──────────────────────────────────────── */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0 space-y-3">
          <button
            onClick={handlePay}
            disabled={loading || !priceStr}
            className="w-full bg-[#FB923C] hover:bg-[#F97316] disabled:opacity-50
                       disabled:pointer-events-none text-white font-bold text-lg
                       py-3.5 rounded-xl shadow-md transition-colors
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-5 w-5 border-2 border-white/30 border-t-white
                                  rounded-full animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                <CreditCard size={20} />
                {user
                  ? `Pay ${priceStr} with ${provider === 'paystack' ? 'Paystack' : provider === 'paypal' ? 'PayPal' : 'Flutterwave'}`
                  : `Login & Pay ${priceStr}`}
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2
                           text-xs text-gray-500 font-medium">
            <ShieldCheck size={15} className="text-green-600 shrink-0" />
            Secured by Flutterwave, Paystack &amp; PayPal · Instant download after payment
          </div>
        </div>
      </div>
    </div>
  );
}
