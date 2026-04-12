'use client';

/**
 * StorefrontClient — rich bookstore + music store layout
 *
 * Sections:
 *  1. Category nav bar (sticky below main Navbar)
 *  2. Hero — featured product spotlight
 *  3. "New & Bestselling Books" — horizontal scroll row
 *  4. "Music Albums" — dark Spotify-style grid
 *  5. Browse All — tab-filtered full product grid
 */

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen, Music, Star, TrendingUp, ShoppingBag,
  ArrowRight, ChevronLeft, ChevronRight, Download,
  ExternalLink, ShieldCheck,
} from 'lucide-react';
import CheckoutModal from './CheckoutModal';

// ── Constants ────────────────────────────────────────────────────────────────

const CURRENCY_META = {
  NGN: { symbol: '₦', label: 'NGN ₦' },
  USD: { symbol: '$', label: 'USD $' },
  GBP: { symbol: '£', label: 'GBP £' },
  EUR: { symbol: '€', label: 'EUR €' },
};

const BOOK_GRADIENTS = [
  'from-red-800     to-rose-950',
  'from-indigo-800  to-indigo-950',
  'from-emerald-800 to-teal-950',
  'from-amber-700   to-orange-900',
  'from-purple-800  to-violet-950',
  'from-sky-700     to-cyan-900',
  'from-slate-700   to-slate-900',
  'from-rose-700    to-pink-900',
];

const MUSIC_GRADIENTS = [
  'from-violet-600 to-purple-900',
  'from-blue-600   to-indigo-900',
  'from-pink-600   to-rose-900',
  'from-emerald-600 to-teal-900',
  'from-orange-500 to-red-800',
  'from-cyan-600   to-blue-900',
  'from-yellow-500 to-orange-800',
  'from-green-600  to-emerald-900',
];

function formatPrice(pricing, currency) {
  const amount = pricing?.[currency.toLowerCase()];
  if (amount == null) return null;
  const { symbol } = CURRENCY_META[currency];
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: currency === 'NGN' ? 0 : 2,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  })}`;
}

// ── Root Component ───────────────────────────────────────────────────────────

export default function StorefrontClient({ initialProducts = [] }) {
  const [activeTab, setActiveTab]           = useState('all');
  const [currency, setCurrency]             = useState('NGN');
  const [checkoutProduct, setCheckoutProduct] = useState(null);

  const books  = useMemo(() => initialProducts.filter((p) => p.productType === 'book'),  [initialProducts]);
  const albums = useMemo(() => initialProducts.filter((p) => p.productType === 'audio'), [initialProducts]);

  const featured = initialProducts[0] ?? null;

  const filtered = useMemo(() => {
    if (activeTab === 'all')   return initialProducts;
    if (activeTab === 'book')  return books;
    if (activeTab === 'audio') return albums;
    return initialProducts;
  }, [activeTab, initialProducts, books, albums]);

  return (
    <div className="min-h-screen bg-white text-gray-900 -mt-10 font-sans">

      {/* ── 1. CATEGORY NAV BAR ──────────────────────────────────────────── */}
      <nav className="bg-[#b91c1c] text-white sticky top-16 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
                        flex items-center justify-between h-11 gap-6">
          {/* Category pills */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            {[
              { id: 'all',   label: 'All Products',   icon: <ShoppingBag size={14} /> },
              { id: 'book',  label: 'Books',           icon: <BookOpen size={14} /> },
              { id: 'audio', label: 'Music Albums',    icon: <Music size={14} /> },
              { id: 'new',   label: 'New Arrivals',    icon: <TrendingUp size={14} /> },
              { id: 'best',  label: 'Bestsellers',     icon: <Star size={14} /> },
            ].map(({ id, label, icon }) => {
              const isActive = activeTab === id ||
                (id === 'new' && activeTab === 'new') ||
                (id === 'best' && activeTab === 'best');
              const onClick =
                id === 'new'  ? () => setActiveTab('all') :
                id === 'best' ? () => setActiveTab('all') :
                () => setActiveTab(id);
              return (
                <button
                  key={id}
                  onClick={onClick}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs
                              font-semibold whitespace-nowrap transition-colors
                    ${activeTab === id
                      ? 'bg-white/20 text-white'
                      : 'text-red-100 hover:text-white hover:bg-white/10'}`}
                >
                  {icon}{label}
                </button>
              );
            })}
          </div>

          {/* Currency selector */}
          <select
            className="bg-white/10 border border-white/20 text-white text-xs
                       rounded px-2 py-1 focus:outline-none focus:ring-1
                       focus:ring-white/50 shrink-0 cursor-pointer"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {Object.entries(CURRENCY_META).map(([code, { label }]) => (
              <option key={code} value={code} className="bg-red-800 text-white">
                {label}
              </option>
            ))}
          </select>
        </div>
      </nav>

      {/* ── 2. HERO ──────────────────────────────────────────────────────── */}
      {featured && (
        <HeroSection
          product={featured}
          currency={currency}
          allProducts={initialProducts}
          onBuyNow={setCheckoutProduct}
        />
      )}

      {/* ── 3. NEW & BESTSELLING BOOKS ───────────────────────────────────── */}
      {books.length > 0 && (
        <section className="bg-gray-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              icon={<BookOpen size={20} className="text-[#b91c1c]" />}
              title="New &amp; Bestselling Books"
              subtitle="Digital eBooks — instant download after purchase"
              link={{ label: 'View all books', onClick: () => setActiveTab('book') }}
            />
            <HorizontalBookRow
              products={books}
              currency={currency}
              onBuyNow={setCheckoutProduct}
            />
          </div>
        </section>
      )}

      {/* ── 4. MUSIC ALBUMS (dark Spotify-style) ─────────────────────────── */}
      {albums.length > 0 && (
        <section className="bg-gray-950 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHeader
              icon={<Music size={20} className="text-purple-400" />}
              title="Music Albums"
              subtitle="Full albums — MP3 downloads, yours to keep"
              link={{ label: 'Browse all music', onClick: () => setActiveTab('audio') }}
              dark
            />
            <AlbumGrid
              products={albums}
              currency={currency}
              onBuyNow={setCheckoutProduct}
            />
          </div>
        </section>
      )}

      {/* ── 5. BROWSE ALL ────────────────────────────────────────────────── */}
      <section className="bg-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <SectionHeader
              icon={<ShoppingBag size={20} className="text-slate-700" />}
              title="Browse All Products"
              subtitle={`${filtered.length} product${filtered.length !== 1 ? 's' : ''}`}
            />
            {/* Filter tabs */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0 text-sm">
              {[
                { id: 'all',   label: 'All' },
                { id: 'book',  label: 'Books' },
                { id: 'audio', label: 'Music' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 py-2 font-medium transition-colors
                    ${activeTab === id
                      ? 'bg-[#b91c1c] text-white'
                      : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-20 text-lg">
              No products found in this category.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {filtered.map((product, idx) => (
                <CatalogCard
                  key={product._id}
                  product={product}
                  index={idx}
                  currency={currency}
                  onBuyNow={() => setCheckoutProduct(product)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Trust bar ────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 text-gray-400 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
                        flex flex-wrap justify-center gap-8 text-sm">
          {[
            { icon: <Download size={16} />,    text: 'Instant digital delivery' },
            { icon: <ShieldCheck size={16} />, text: 'Secured by Paystack & Flutterwave' },
            { icon: <Star size={16} />,        text: 'Quality-curated titles' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-gray-400">
              {icon}<span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Checkout Modal ───────────────────────────────────────────────── */}
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

// ── HeroSection ──────────────────────────────────────────────────────────────
function HeroSection({ product, currency, allProducts, onBuyNow }) {
  const priceStr = formatPrice(product.pricing, currency);
  const sideItems = allProducts.slice(1, 4);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

          {/* Left — featured product */}
          <div className="flex gap-6 items-start">
            {/* Cover */}
            <Link href={`/products/${product.slug}`} className="shrink-0">
              <div className={`w-36 sm:w-44 rounded-xl overflow-hidden shadow-2xl
                               aspect-[3/4] bg-gradient-to-br ${BOOK_GRADIENTS[0]}
                               relative ring-2 ring-white/10`}>
                {product.coverImageUrl ? (
                  <Image
                    src={product.coverImageUrl}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="176px"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-end p-4">
                    <span className="text-white font-bold text-sm leading-tight">
                      {product.title}
                    </span>
                  </div>
                )}
              </div>
            </Link>

            {/* Info */}
            <div className="flex-1 pt-2 space-y-3">
              <span className="inline-block bg-[#b91c1c] text-white text-[11px]
                               font-bold px-3 py-0.5 rounded-full uppercase tracking-wide">
                {product.productType === 'audio' ? '🎵 Music Album' : '📚 Featured Book'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                {product.title}
              </h1>
              {product.creator && (
                <p className="text-slate-400 text-sm">by {product.creator}</p>
              )}
              <p className="text-slate-300 text-sm leading-relaxed line-clamp-3">
                {product.description}
              </p>
              <div className="flex items-center gap-4 pt-1">
                <span className="text-3xl font-black text-white">
                  {priceStr ?? '—'}
                </span>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => onBuyNow(product)}
                  disabled={!priceStr}
                  className="bg-[#b91c1c] hover:bg-red-700 disabled:opacity-40
                             text-white font-bold px-6 py-2.5 rounded-lg text-sm
                             transition-colors flex items-center gap-2"
                >
                  <ShoppingBag size={16} />
                  Buy Now
                </button>
                <Link
                  href={`/products/${product.slug}`}
                  className="border border-white/20 hover:border-white/40 text-white/80
                             hover:text-white font-semibold px-5 py-2.5 rounded-lg text-sm
                             transition-colors flex items-center gap-1.5"
                >
                  Details <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* Right — mini list of other products */}
          {sideItems.length > 0 && (
            <div className="hidden lg:block space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                Also Available
              </p>
              {sideItems.map((p, idx) => {
                const ps = formatPrice(p.pricing, currency);
                return (
                  <div key={p._id}
                    className="flex items-center gap-3 bg-white/5 hover:bg-white/10
                               rounded-xl p-3 transition-colors group cursor-pointer"
                    onClick={() => onBuyNow(p)}
                  >
                    <div className={`w-12 h-16 rounded-lg overflow-hidden shrink-0
                                     bg-gradient-to-br ${BOOK_GRADIENTS[(idx + 1) % BOOK_GRADIENTS.length]}
                                     relative`}>
                      {p.coverImageUrl && (
                        <Image src={p.coverImageUrl} alt={p.title} fill
                          className="object-cover" sizes="48px" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                      {p.creator && <p className="text-xs text-slate-400">{p.creator}</p>}
                    </div>
                    <span className="text-sm font-bold text-white/80 shrink-0">{ps}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HorizontalBookRow ────────────────────────────────────────────────────────
function HorizontalBookRow({ products, currency, onBuyNow }) {
  return (
    <div className="relative">
      <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-thin
                      scrollbar-thumb-gray-300 scrollbar-track-transparent snap-x snap-mandatory">
        {products.map((product, idx) => {
          const priceStr = formatPrice(product.pricing, currency);
          return (
            <div
              key={product._id}
              className="shrink-0 w-40 sm:w-44 snap-start"
            >
              {/* Cover */}
              <Link href={`/products/${product.slug}`} className="block group">
                <div className={`w-full aspect-[3/4] rounded-xl overflow-hidden shadow-md
                                  bg-gradient-to-br ${BOOK_GRADIENTS[idx % BOOK_GRADIENTS.length]}
                                  relative mb-3`}>
                  {product.coverImageUrl ? (
                    <Image
                      src={product.coverImageUrl}
                      alt={product.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="176px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-end p-3">
                      <span className="text-white text-xs font-bold leading-tight line-clamp-3">
                        {product.title}
                      </span>
                    </div>
                  )}
                  {/* Bestseller badge for top 3 */}
                  {idx < 3 && (
                    <div className="absolute top-2 left-2 bg-[#b91c1c] text-white
                                     text-[9px] font-bold px-1.5 py-0.5 rounded">
                      #{idx + 1} Bestseller
                    </div>
                  )}
                </div>
              </Link>

              {/* Info */}
              <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-0.5 leading-tight">
                {product.title}
              </h4>
              {product.creator && (
                <p className="text-xs text-gray-500 mb-2">{product.creator}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">
                  {priceStr ?? <span className="text-gray-400">—</span>}
                </span>
                <button
                  onClick={() => onBuyNow(product)}
                  disabled={!priceStr}
                  className="text-xs bg-[#b91c1c] text-white font-semibold px-2.5 py-1
                             rounded-md hover:bg-red-700 transition-colors disabled:opacity-40"
                >
                  Buy
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AlbumGrid (dark Spotify-style) ───────────────────────────────────────────
function AlbumGrid({ products, currency, onBuyNow }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product, idx) => {
        const priceStr = formatPrice(product.pricing, currency);
        return (
          <div
            key={product._id}
            className="group cursor-pointer"
            onClick={() => onBuyNow(product)}
          >
            {/* Square album art */}
            <div className={`aspect-square rounded-xl overflow-hidden shadow-lg
                              bg-gradient-to-br ${MUSIC_GRADIENTS[idx % MUSIC_GRADIENTS.length]}
                              relative mb-3`}>
              {product.coverImageUrl ? (
                <Image
                  src={product.coverImageUrl}
                  alt={product.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center
                                 justify-center gap-2 text-white/70">
                  <Music size={36} />
                  <span className="text-xs font-medium text-center px-3 line-clamp-2">
                    {product.title}
                  </span>
                </div>
              )}

              {/* Hover overlay with buy button */}
              <div className="absolute inset-0 bg-black/50 opacity-0
                               group-hover:opacity-100 transition-opacity
                               flex items-center justify-center">
                <div className="bg-white text-gray-900 rounded-full p-3 shadow-lg
                                 transform scale-90 group-hover:scale-100 transition-transform">
                  <ShoppingBag size={20} />
                </div>
              </div>
            </div>

            {/* Info */}
            <h4 className="text-sm font-semibold text-white line-clamp-1 mb-0.5">
              {product.title}
            </h4>
            {product.creator && (
              <p className="text-xs text-gray-400 mb-1">{product.creator}</p>
            )}
            {product.trackList?.length > 0 && (
              <p className="text-xs text-gray-500">
                {product.trackList.length} tracks
              </p>
            )}
            <p className="text-sm font-bold text-purple-400 mt-1">
              {priceStr ?? '—'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── CatalogCard (browse-all grid) ────────────────────────────────────────────
function CatalogCard({ product, index, currency, onBuyNow }) {
  const isAudio  = product.productType === 'audio';
  const gradient = isAudio
    ? MUSIC_GRADIENTS[index % MUSIC_GRADIENTS.length]
    : BOOK_GRADIENTS[index % BOOK_GRADIENTS.length];
  const priceStr = formatPrice(product.pricing, currency);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm
                     overflow-hidden hover:shadow-md transition-shadow group flex flex-col">

      {/* Cover */}
      <Link href={`/products/${product.slug}`} className="block">
        <div className={`${isAudio ? 'aspect-square' : 'aspect-[3/4]'}
                          w-full bg-gradient-to-br ${gradient} relative overflow-hidden`}>
          {product.coverImageUrl ? (
            <Image
              src={product.coverImageUrl}
              alt={product.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center
                             justify-center text-white/70 gap-2 p-3">
              {isAudio ? <Music size={28} /> : <BookOpen size={28} />}
              <span className="text-[11px] font-medium text-center line-clamp-3">
                {product.title}
              </span>
            </div>
          )}

          {/* Type badge */}
          <span className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm
                            text-white text-[9px] font-bold px-2 py-0.5
                            rounded-full uppercase tracking-wider">
            {isAudio ? 'Album' : 'Book'}
          </span>
        </div>
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col flex-grow">
        <h3 className="text-xs font-bold text-gray-900 line-clamp-2 mb-0.5 leading-snug">
          {product.title}
        </h3>
        {product.creator && (
          <p className="text-[11px] text-gray-400 mb-2">{product.creator}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-1">
          <span className="text-sm font-extrabold text-gray-900">
            {priceStr ?? <span className="text-gray-300 text-xs">N/A</span>}
          </span>
          <button
            onClick={onBuyNow}
            disabled={!priceStr}
            className="shrink-0 bg-[#b91c1c] text-white text-[11px] font-bold
                       px-2.5 py-1 rounded-md hover:bg-red-700 transition-colors
                       disabled:opacity-40 disabled:pointer-events-none"
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, link, dark = false }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <h2 className={`text-xl sm:text-2xl font-extrabold
                          ${dark ? 'text-white' : 'text-gray-900'}`}
            dangerouslySetInnerHTML={{ __html: title }}
          />
        </div>
        {subtitle && (
          <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>
        )}
      </div>
      {link && (
        <button
          onClick={link.onClick}
          className={`text-sm font-semibold flex items-center gap-1 shrink-0
                      ${dark
                        ? 'text-purple-400 hover:text-purple-300'
                        : 'text-[#b91c1c] hover:text-red-700'} transition-colors`}
        >
          {link.label} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
