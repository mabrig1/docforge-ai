import FreeCatalogClient from '@/components/storefront/FreeCatalogClient';

export const metadata = {
  title: 'Free Books, Music & Resources — Mabrig Korie Store',
  description: 'Download free faith-based books, gospel music and transformative resources from Mabrig Korie.',
  alternates: { canonical: 'https://store.mabrigkorie.org/free' },
  openGraph: {
    title: 'Mabrig Free Library — Books, Music & Faith Resources',
    description: 'Free downloads from Mabrig Korie. No payment or account required.',
    url: 'https://store.mabrigkorie.org/free',
    siteName: 'Mabrig Korie Store',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Mabrig Free Library',
    description: 'Free books, gospel music and faith resources.',
  },
};

export default function FreePage() {
  return <FreeCatalogClient />;
}
