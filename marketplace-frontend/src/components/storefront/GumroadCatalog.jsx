import { ExternalLink, ShoppingBag } from 'lucide-react';

const GUMROAD_PRODUCTS = [
  {
    title: 'Prayers that Defeat the Enemy',
    price: '£2.93',
    url: 'https://mabrig.gumroad.com/l/xPHKL',
    image: 'https://public-files.gumroad.com/llvvotvaqsmslyox7wdm6gydoz3u',
  },
  {
    title: 'Legislating Dominion: An Authoritative Manual for Overcoming the Ruling Principalities of Darkness',
    price: '£2.20+',
    url: 'https://mabrig.gumroad.com/l/qdsogz',
    image: 'https://public-files.gumroad.com/nh89vljs55tbxrtdzmmolmp8upqb',
  },
  {
    title: 'Breaking Witchcraft: Powerful Prayers, Decrees, and Confessions that Break and Destroy Dark Powers',
    price: '£2.20+',
    url: 'https://mabrig.gumroad.com/l/nkszxl',
    image: 'https://public-files.gumroad.com/wyaw34ruszytrkeakz7grn2m9oyk',
  },
  {
    title: 'When Heaven Goes to War: Prayers that Unleash Angelic Power',
    price: '£2.93+',
    url: 'https://mabrig.gumroad.com/l/vteus',
    image: 'https://public-files.gumroad.com/5rcrliuffvxa6ohdkgbqfh2p4kbi',
  },
  {
    title: 'MIDNIGHT FIRE: Prayers That Destroy Witchcraft and Black Magic',
    price: '£2.93',
    url: 'https://mabrig.gumroad.com/l/zastel',
    image: 'https://public-files.gumroad.com/9cqb0kcu3iuwhx5u0blbr7jkzwl7',
  },
  {
    title: 'UNSTOPPABLE PURPOSE: Awakening the God-Dream in You for Success, Power, and Fulfillment',
    price: '£2.93',
    url: 'https://mabrig.gumroad.com/l/hvxhj',
    image: 'https://public-files.gumroad.com/4jm134qmiii3sicxm1icxouq3scl',
  },
  {
    title: 'The Arrogance-Ignorance Polarity Theory (AIPT): How Pride and Teachability Shape Lives, Leaders, and Nations',
    price: '£2.93',
    url: 'https://mabrig.gumroad.com/l/jcixa',
    image: 'https://public-files.gumroad.com/xyasbndpxhn7nbk8anxi08vfvy3c',
  },
  {
    title: 'The Degeneration–Judgment–Redemption (DJR) Model of National Collapse',
    price: '£2.93',
    url: 'https://mabrig.gumroad.com/l/fteesr',
    image: 'https://public-files.gumroad.com/wswk2tku3kepn53kvgsgho1nnemd',
  },
  {
    title: 'The Dark Web of Africa: How Witchcraft Spreads and How to Destroy Its Strongholds',
    price: '£2.93',
    url: 'https://mabrig.gumroad.com/l/dslzv',
    image: 'https://public-files.gumroad.com/7acblu057tzu63ckk7wbqcz7ccr2',
  },
];

export default function GumroadCatalog() {
  return (
    <section className="bg-slate-950 py-14 text-white" aria-labelledby="gumroad-books">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
              Official Mabrig Korie Catalogue
            </p>
            <h2 id="gumroad-books" className="text-2xl font-extrabold sm:text-3xl">
              More Books on Gumroad
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Discover prophetic prayer manuals, spiritual-warfare books, and transformational theories.
              Secure checkout and instant delivery are handled by Gumroad.
            </p>
          </div>
          <a
            href="https://mabrig.gumroad.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
          >
            View complete Gumroad profile <ExternalLink size={15} />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {GUMROAD_PRODUCTS.map((product) => (
            <article
              key={product.url}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg transition hover:-translate-y-1 hover:border-emerald-600"
            >
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-[3/4] overflow-hidden bg-slate-800"
                aria-label={`View ${product.title} on Gumroad`}
              >
                <img
                  src={product.image}
                  alt={`${product.title} book cover`}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 hover:scale-105"
                />
              </a>
              <div className="flex flex-1 flex-col p-3">
                <h3 className="line-clamp-3 text-sm font-bold leading-snug text-white">
                  {product.title}
                </h3>
                <p className="mt-2 text-lg font-extrabold text-emerald-400">{product.price}</p>
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
                >
                  <ShoppingBag size={14} /> Buy on Gumroad
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
