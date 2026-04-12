'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, Music, ChevronRight } from 'lucide-react';
import CheckoutModal from './CheckoutModal';

// ── Cover gradient fallbacks (cycled by index when no coverImageUrl) ────────
const GRADIENTS = [
  'from-slate-700  to-slate-900',
  'from-blue-700   to-blue-900',
  'from-emerald-700 to-emerald-900',
  'from-red-800    to-red-950',
  'from-purple-800 to-indigo-900',
  'from-amber-700  to-orange-900',
  'from-teal-700   to-cyan-900',
  'from-rose-700   to-pink-900',
];

const CURRENCY_META = {
  NGN: { symbol: '₦', label: 'NGN (₦)' },
  USD: { symbol: '$', label: 'USD ($)' },
  GBP: { symbol: '£', label: 'GBP (£)' },
  EUR: { symbol: '€', label: 'EUR (€)' },
};

/**
 * Formats a product's pricing object for the selected currency.
 * Products from the DB use lowercase keys: { ngn, usd, gbp, eur }.
 */
function formatPrice(pricing, currency) {
  const amount = pricing?.[currency.toLowerCase()];
  if (amount == null) return null;
  const { symbol } = CURRENCY_META[currency];
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: currency === 'NGN' ? 0 : 2,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  })}`;
}

/**
 * StorefrontClient
 *
 * Receives the initial product list from the SSR Server Component
 * and handles all interactive state (tabs, currency, checkout modal).
 *
 * @param {{ initialProducts: Product[] }} props
 */
export default function StorefrontClient({ initialProducts = [] }) {
  const [activeTab, setActiveTab]           = useState('all');
  const [currency, setCurrency]             = useState('NGN');
  const [checkoutProduct, setCheckoutProduct] = useState(null);

  const filtered = initialProducts.filter(
    (p) => activeTab === 'all' || p.productType === activeTab
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 -mt-10">

      {/* ── NAV currency selector (injected into the existing Navbar via a
           separate sticky bar so it doesn't duplicate the main Navbar) ──── */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500 hidden sm:block">
            Instant digital downloads · Secure payments
          </span>
          <select
            className="bg-gray-100 text-sm font-medium rounded-md py-1.5 px-3
                       border-none focus:ring-2 focus:ring-slate-900 ml-auto"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {Object.entries(CURRENCY_META).map(([code, { label }]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Digital Vault of{' '}
            <span className="text-blue-400">Knowledge & Sound</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Direct access to the latest prophetic books, strategic guides, and gospel music albums.
            Instantly delivered to your device anywhere in the world.
          </p>
        </div>
      </header>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">

        {/* Tab bar */}
        <div className="bg-white rounded-xl shadow-sm p-2 flex justify-center gap-2 mb-10
                         max-w-md mx-auto">
          {[
            { id: 'all',   label: 'All Products' },
            { id: 'book',  label: 'Books',  icon: <BookOpen size={15} /> },
            { id: 'audio', label: 'Music',  icon: <Music   size={15} /> },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors
                          flex items-center justify-center gap-1.5
                ${activeTab === id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-gray-500 hover:text-gray-900'}`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-20">No products found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filtered.map((product, idx) => (
              <ProductCard
                key={product._id}
                product={product}
                index={idx}
                currency={currency}
                onBuyNow={() => setCheckoutProduct(product)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── CHECKOUT MODAL ───────────────────────────────────────────────── */}
      {checkoutProduct && (
        <CheckoutModal
          product={checkoutProduct}
          currency={currency}
          onClose={() => setCheckoutProduct(null)}
        />
      )}
    </div>
  );
}

// ── ProductCard ──────────────────────────────────────────────────────────────
function ProductCard({ product, index, currency, onBuyNow }) {
  const gradient  = GRADIENTS[index % GRADIENTS.length];
  const priceStr  = formatPrice(product.pricing, currency);
  const typeLabel = product.productType === 'audio' ? 'Album' : 'Book';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden
                     hover:shadow-lg transition-shadow group flex flex-col">

      {/* Cover — real image if available, gradient fallback */}
      <Link href={`/products/${product.slug}`} className="block">
        <div className={`aspect-[3/4] w-full bg-gradient-to-br ${gradient}
                          relative overflow-hidden`}>
          {product.coverImageUrl ? (
            <Image
              src={product.coverImageUrl}
              alt={product.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col justify-end p-6
                             group-hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-2xl leading-tight mb-1 drop-shadow-md">
                {product.title}
              </h3>
              {product.creator && (
                <p className="text-white/70 text-sm drop-shadow-sm">{product.creator}</p>
              )}
            </div>
          )}

          {/* Type badge */}
          <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm
                            rounded-full px-3 py-0.5 text-xs font-semibold
                            text-white tracking-wider uppercase">
            {typeLabel}
          </span>
        </div>
      </Link>

      {/* Info + CTA */}
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex-grow">
          <h3 className="font-bold text-base mb-1 line-clamp-1">{product.title}</h3>
          {product.creator && (
            <p className="text-xs text-gray-400 mb-1">by {product.creator}</p>
          )}
          <p className="text-gray-500 text-sm line-clamp-2">{product.description}</p>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <span className="font-extrabold text-xl">
            {priceStr ?? <span className="text-gray-400 text-sm">N/A</span>}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={`/products/${product.slug}`}
              className="text-gray-400 hover:text-gray-700 transition-colors p-1"
              title="View details"
            >
              <ChevronRight size={18} />
            </Link>
            <button
              onClick={onBuyNow}
              disabled={!priceStr}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold
                         text-sm hover:bg-slate-700 transition-colors disabled:opacity-40
                         disabled:pointer-events-none"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
