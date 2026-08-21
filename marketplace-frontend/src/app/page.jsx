/**
 * Root storefront page — Server Component.
 *
 * Fetches the published product list at request time (ISR, 60-second revalidation)
 * and combines the native marketplace catalogue with Mabrig Korie's official
 * Gumroad catalogue.
 */

import { listProducts } from '@/lib/api';
import StorefrontClient from '@/components/storefront/StorefrontClient';
import GumroadCatalog from '@/components/storefront/GumroadCatalog';

export const revalidate = 60;

export const metadata = {
  title: 'Mabrig Korie Store — Books & Music',
  description:
    'Direct access to Mabrig Korie prophetic books, strategic guides, and gospel music. ' +
    'Secure digital delivery through the Mabrig store and Gumroad.',
};

export default async function StorefrontPage() {
  let products = [];
  try {
    products = await listProducts();
  } catch {
    // Fail gracefully — the Gumroad catalogue remains available.
  }

  return (
    <>
      <StorefrontClient initialProducts={products} />
      <GumroadCatalog />
    </>
  );
}
