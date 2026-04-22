/**
 * Product Detail Page — /products/[slug]
 *
 * generateMetadata runs server-side for SEO (fails gracefully to a default
 * title if the backend isn't reachable from the server).
 *
 * The page body delegates to ProductDetailClient which fetches the product
 * from the browser, going through Vercel's /api rewrite to the backend.
 * This avoids the issue where server-side fetch() calls don't go through
 * Vercel edge rewrites and therefore can't reach the Express backend.
 */

import { getProduct } from '@/lib/api';
import ProductDetailClient from './ProductDetailClient';

export async function generateMetadata({ params }) {
  try {
    const product = await getProduct(params.slug);
    return {
      title: `${product.title} — DocForge Marketplace`,
      description: product.description?.slice(0, 155),
    };
  } catch {
    return { title: 'Product — DocForge Marketplace' };
  }
}

export default function ProductPage({ params }) {
  return <ProductDetailClient slug={params.slug} />;
}
