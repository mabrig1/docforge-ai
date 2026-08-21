'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getProduct } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import CheckoutSection from './CheckoutSection';
import AudioPlayer from './AudioPlayer';

export default function ProductDetailClient({ slug }) {
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getProduct(slug)
      .then(setProduct)
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div className="page-shell flex flex-col items-center justify-center gap-6 py-24 text-center">
        <p className="text-6xl font-extrabold text-gray-700">404</p>
        <h1 className="text-2xl font-bold text-white">Product not found</h1>
        <p className="text-gray-400">This product may have been removed or the link is invalid.</p>
        <Link href="/" className="btn-primary">Back to Store</Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page-shell grid grid-cols-1 md:grid-cols-2 gap-10 animate-pulse">
        <div className="aspect-[3/4] w-full max-w-sm mx-auto rounded-2xl bg-gray-800" />
        <div className="space-y-4 py-4">
          <div className="h-4 bg-gray-800 rounded w-1/3" />
          <div className="h-8 bg-gray-800 rounded w-full" />
          <div className="h-8 bg-gray-800 rounded w-4/5" />
          <div className="h-24 bg-gray-800 rounded w-full" />
        </div>
      </div>
    );
  }

  const { pricing, productType, trackList, fileSizeBytes } = product;

  return (
    <div className="page-shell grid grid-cols-1 md:grid-cols-2 gap-10">
      {/* Cover image */}
      <div className="relative aspect-[3/4] w-full max-w-sm mx-auto rounded-2xl
                       overflow-hidden bg-gray-800 shadow-2xl">
        {product.coverImageUrl ? (
          <Image
            src={product.coverImageUrl}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-7xl">
            {productType === 'audio' ? '🎵' : '📖'}
          </div>
        )}
      </div>

      {/* Details + checkout */}
      <div className="space-y-6">
        <span className="inline-block rounded-full bg-brand-900/50 border border-brand-700
                          px-3 py-0.5 text-xs font-medium text-brand-300 uppercase tracking-wide">
          {productType === 'audio' ? 'Music Album' : 'Digital Book'}
        </span>

        <div>
          <h1 className="text-3xl font-extrabold text-white leading-tight">
            {product.title}
          </h1>
          {product.creator && (
            <p className="mt-1 text-gray-400">by {product.creator}</p>
          )}
        </div>

        <p className="text-gray-300 leading-relaxed">{product.description}</p>

        <div className="flex flex-wrap gap-2 text-xs">
          {fileSizeBytes && (
            <span className="chip">⬇ {formatFileSize(fileSizeBytes)}</span>
          )}
          {product.salesCount > 0 && (
            <span className="chip">🛒 {product.salesCount} sold</span>
          )}
        </div>

        {productType === 'audio' && product.allowStreaming && (
          <AudioPlayer product={product} />
        )}

        {productType === 'audio' && trackList?.length > 0 && (
          <div className="card space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Track Listing
            </h3>
            <ol className="space-y-1">
              {trackList.map((track, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-400">
                  <span className="w-5 text-gray-600 text-right">{i + 1}.</span>
                  <span>{track}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <CheckoutSection product={product} />
      </div>
    </div>
  );
}
