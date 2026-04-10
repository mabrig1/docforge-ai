import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency } from '@/lib/utils';

/**
 * Displays a product thumbnail, title, creator, and starting price.
 * Used on the storefront grid.
 */
export default function ProductCard({ product }) {
  const lowestPrice = getLowestPrice(product.pricing);

  return (
    <Link href={`/products/${product.slug}`}
      className="group flex flex-col rounded-xl border border-gray-800 bg-gray-900
                 overflow-hidden hover:border-brand-600 transition-colors">
      {/* Cover image */}
      <div className="relative aspect-[3/4] w-full bg-gray-800">
        {product.coverImageUrl ? (
          <Image
            src={product.coverImageUrl}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-4xl">
            {product.productType === 'audio' ? '🎵' : '📖'}
          </div>
        )}
        {/* Badge */}
        <span className="absolute top-2 left-2 rounded-full bg-gray-950/80 px-2.5 py-0.5
                          text-xs font-medium text-gray-300 uppercase tracking-wide">
          {product.productType === 'audio' ? 'Album' : 'Book'}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-4 flex-1">
        <h3 className="font-semibold text-gray-100 line-clamp-2 group-hover:text-brand-300 transition-colors">
          {product.title}
        </h3>
        {product.creator && (
          <p className="text-sm text-gray-400">{product.creator}</p>
        )}
        <p className="mt-auto pt-2 text-sm font-bold text-brand-400">
          {lowestPrice ? `From ${lowestPrice}` : 'Price unavailable'}
        </p>
      </div>
    </Link>
  );
}

function getLowestPrice(pricing) {
  if (!pricing) return null;
  const pairs = [
    ['NGN', pricing.ngn],
    ['USD', pricing.usd],
    ['GBP', pricing.gbp],
    ['EUR', pricing.eur],
  ].filter(([, v]) => v != null);
  if (!pairs.length) return null;
  // Show NGN first if available, otherwise the first available currency
  const preferred = pairs.find(([c]) => c === 'NGN') || pairs[0];
  return formatCurrency(preferred[1], preferred[0]);
}
