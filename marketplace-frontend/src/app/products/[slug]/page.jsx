/**
 * Product Detail Page — /products/[slug]
 *
 * Product-specific metadata is fetched directly from the production API so
 * social networks receive the correct title, cover and description.
 */

import ProductDetailClient from './ProductDetailClient';

const STORE_ORIGIN = 'https://store.mabrigkorie.org';
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'https://docforgebackend.vercel.app';

async function getProductForMetadata(slug) {
  const response = await fetch(`${API_ORIGIN}/api/products/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error('Product metadata unavailable');
  const data = await response.json();
  return data.product;
}

export async function generateMetadata({ params }) {
  try {
    const product = await getProductForMetadata(params.slug);
    const title = `${product.title} — Mabrig Korie Store`;
    const description = product.description?.slice(0, 155);
    const url = `${STORE_ORIGIN}/products/${product.slug}`;
    const images = product.coverImageUrl
      ? [{ url: product.coverImageUrl, alt: product.title }]
      : [];

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        siteName: 'Mabrig Korie Store',
        type: 'website',
        images,
      },
      twitter: {
        card: images.length ? 'summary_large_image' : 'summary',
        title,
        description,
        images: images.map((image) => image.url),
      },
    };
  } catch {
    return {
      title: 'Product — Mabrig Korie Store',
      description: 'Books, gospel music and transformative resources from Mabrig Korie.',
    };
  }
}

export default function ProductPage({ params }) {
  return <ProductDetailClient slug={params.slug} />;
}
