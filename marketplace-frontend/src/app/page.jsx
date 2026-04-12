/**
 * Root storefront page — Server Component.
 *
 * Fetches the published product list at request time (ISR, 60-second revalidation)
 * and passes it to StorefrontClient for all interactive behaviour.
 *
 * This split gives us:
 *   • Full SSR for the initial product grid (SEO, no loading flash)
 *   • Rich client-side interactivity (tabs, currency, checkout modal)
 */

import { listProducts } from '@/lib/api';
import StorefrontClient from '@/components/storefront/StorefrontClient';

export const revalidate = 60;

export const metadata = {
  title: 'DocForge Marketplace — Books & Music',
  description:
    'Direct access to prophetic books, strategic guides, and gospel music albums. ' +
    'Instant download after secure payment via Paystack or Flutterwave.',
};

export default async function StorefrontPage() {
  let products = [];
  try {
    products = await listProducts();
  } catch {
    // Fail silently — StorefrontClient handles the empty state
  }

  return <StorefrontClient initialProducts={products} />;
}
