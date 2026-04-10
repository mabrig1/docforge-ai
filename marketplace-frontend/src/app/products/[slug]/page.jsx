/**
 * Product Detail Page — /products/[slug]
 *
 * Server Component: fetches product data for SSR + metadata.
 * The checkout button is a Client Component embedded below.
 */

import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/api';
import { formatCurrency, formatFileSize } from '@/lib/utils';
import CheckoutSection from './CheckoutSection';

export async function generateMetadata({ params }) {
  try {
    const product = await getProduct(params.slug);
    return {
      title: `${product.title} — DocForge Marketplace`,
      description: product.description.slice(0, 155),
    };
  } catch {
    return { title: 'Product — DocForge Marketplace' };
  }
}

export default async function ProductPage({ params }) {
  let product;
  try {
    product = await getProduct(params.slug);
  } catch {
    notFound();
  }

  const { pricing, productType, trackList, fileSizeBytes } = product;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
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
        {/* Badge */}
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

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          {fileSizeBytes && (
            <span className="chip">⬇ {formatFileSize(fileSizeBytes)}</span>
          )}
          {product.salesCount > 0 && (
            <span className="chip">🛒 {product.salesCount} sold</span>
          )}
        </div>

        {/* Track listing (audio only) */}
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

        {/* Pricing + checkout — Client Component */}
        <CheckoutSection product={product} />
      </div>
    </div>
  );
}
