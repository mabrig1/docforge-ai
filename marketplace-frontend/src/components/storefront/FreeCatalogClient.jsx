'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, Download, Gift, Music } from 'lucide-react';
import { listProducts } from '@/lib/api';
import ShareButtons from './ShareButtons';

export default function FreeCatalogClient() {
  const [products, setProducts] = useState([]);
  const [type, setType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listProducts()
      .then((items) => setProducts(items.filter((product) => product.isFree)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => type === 'all' ? products : products.filter((product) => product.productType === type),
    [products, type]
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <section className="border-b border-emerald-900/60 bg-gradient-to-br from-emerald-950 via-gray-950 to-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex max-w-3xl items-start gap-4">
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
              <Gift size={32} />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">Mabrig Free Library</p>
              <h1 className="mt-2 text-3xl font-black sm:text-5xl">Free books, music and faith resources</h1>
              <p className="mt-4 text-base leading-relaxed text-gray-300 sm:text-lg">
                Download transformative resources freely. No payment or account is required.
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Free', icon: Gift },
            { id: 'book', label: 'Free Books', icon: BookOpen },
            { id: 'audio', label: 'Free Music', icon: Music },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setType(id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${
                type === id
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-emerald-700'
              }`}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-20 text-center text-gray-400">Loading free resources…</p>
        ) : error ? (
          <div className="rounded-xl border border-red-800 bg-red-950/30 p-5 text-red-300">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 py-20 text-center">
            <Gift className="mx-auto text-gray-600" size={40} />
            <h2 className="mt-4 text-xl font-bold">More free resources are coming</h2>
            <p className="mt-2 text-gray-400">Please check again soon.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <article key={product._id} className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-xl">
                <Link href={`/products/${product.slug}`} className="block">
                  <div className="relative aspect-[3/4] bg-gray-800">
                    {product.coverImageUrl ? (
                      <Image
                        src={product.coverImageUrl}
                        alt={product.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-6xl">
                        {product.productType === 'audio' ? '🎵' : '📖'}
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow-lg">
                      FREE
                    </span>
                  </div>
                </Link>
                <div className="space-y-4 p-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                      {product.productType === 'audio' ? 'Music' : 'Digital book'}
                    </p>
                    <Link href={`/products/${product.slug}`}>
                      <h2 className="mt-1 line-clamp-2 text-lg font-extrabold hover:text-emerald-300">{product.title}</h2>
                    </Link>
                    {product.creator ? <p className="mt-1 text-sm text-gray-400">by {product.creator}</p> : null}
                  </div>
                  <Link
                    href={`/products/${product.slug}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500"
                  >
                    <Download size={17} /> Get it free
                  </Link>
                  <ShareButtons product={product} compact />
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
