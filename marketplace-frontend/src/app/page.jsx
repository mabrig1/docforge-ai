/**
 * Storefront — root page
 *
 * This is a Server Component. It fetches the product list on the server
 * (no auth required) so the page is fully SSR'd and SEO-friendly.
 *
 * Optional query param: ?type=book | ?type=audio
 */

import { listProducts } from '@/lib/api';
import ProductCard from '@/components/ui/ProductCard';

export const revalidate = 60; // ISR: re-fetch product list every 60 seconds

export default async function StorefrontPage({ searchParams }) {
  const type = searchParams?.type; // "book" | "audio" | undefined
  let products = [];
  let error = null;

  try {
    products = await listProducts(type);
  } catch (e) {
    error = e.message;
  }

  const heading =
    type === 'book'  ? 'Digital Books'
    : type === 'audio' ? 'Music Albums'
    : 'All Products';

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-900/40 to-gray-900
                           border border-brand-800/40 p-10 text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          Welcome to <span className="text-brand-400">DocForge</span> Marketplace
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          Premium digital books and music albums. Instant download after purchase.
        </p>
      </section>

      {/* Product grid */}
      <section>
        <h2 className="text-xl font-bold text-gray-100 mb-6">{heading}</h2>

        {error && (
          <p className="text-red-400 text-sm">Failed to load products: {error}</p>
        )}

        {!error && products.length === 0 && (
          <p className="text-gray-500 text-sm">No products available yet. Check back soon.</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
