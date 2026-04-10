'use client';

/**
 * /dashboard — Buyer's purchased library
 *
 * Lists all confirmed orders and provides a "Download" button for each.
 * The download button hits GET /api/download/:productId on the backend
 * which returns a short-lived R2 pre-signed URL; we open it in a new tab.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getMyOrders, getDownloadUrl } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push('/login?redirect=/dashboard');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    getMyOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || (!user && loading)) return <LoadingSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">My Library</h1>
        <p className="text-gray-400 text-sm mt-1">Your purchased digital products</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && orders.length === 0 && (
        <div className="card text-center space-y-4 py-12">
          <p className="text-4xl">📭</p>
          <p className="text-gray-400">You haven&apos;t purchased anything yet.</p>
          <Link href="/" className="btn-primary inline-flex">
            Browse Products
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {orders.map((order) => (
          <PurchasedCard key={order._id} order={order} />
        ))}
      </div>
    </div>
  );
}

// ── Individual purchased product card ─────────────────────────────────────
function PurchasedCard({ order }) {
  const { product, amountCharged, currency, createdAt, downloadCount } = order;
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');

  async function handleDownload() {
    setBusy(true);
    setErr('');
    try {
      const { downloadUrl } = await getDownloadUrl(product._id);
      // Open the signed URL — browser handles the file download
      window.open(downloadUrl, '_blank', 'noopener');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-4">
      {/* Cover */}
      <div className="relative aspect-[3/2] rounded-lg overflow-hidden bg-gray-800">
        {product?.coverImageUrl ? (
          <Image
            src={product.coverImageUrl}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl">
            {product?.productType === 'audio' ? '🎵' : '📖'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 space-y-1">
        <h3 className="font-semibold text-gray-100 line-clamp-2">
          {product?.title ?? 'Unknown product'}
        </h3>
        <p className="text-xs text-gray-500">
          Purchased {new Date(createdAt).toLocaleDateString()} ·{' '}
          {formatCurrency(amountCharged, currency)}
        </p>
        {downloadCount > 0 && (
          <p className="text-xs text-gray-600">Downloaded {downloadCount}×</p>
        )}
      </div>

      {err && <p className="text-xs text-red-400">{err}</p>}

      <button
        onClick={handleDownload}
        disabled={busy}
        className="btn-primary w-full text-sm"
      >
        {busy ? 'Generating link…' : '⬇ Download'}
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card animate-pulse space-y-3">
          <div className="aspect-[3/2] rounded-lg bg-gray-800" />
          <div className="h-4 bg-gray-800 rounded w-3/4" />
          <div className="h-3 bg-gray-800 rounded w-1/2" />
          <div className="h-9 bg-gray-800 rounded" />
        </div>
      ))}
    </div>
  );
}
