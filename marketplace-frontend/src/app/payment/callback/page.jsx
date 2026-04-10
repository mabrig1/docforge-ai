'use client';

/**
 * /payment/callback
 *
 * Flutterwave redirects here after a payment attempt (success OR failure).
 * Query params injected by Flutterwave:
 *   ?status=successful|cancelled|failed
 *   &tx_ref=DF-<userId>-<productId>-<timestamp>
 *   &transaction_id=<flw_txn_id>
 *
 * Important: we do NOT confirm the order here. The backend webhook handler
 * is the authoritative source. This page simply polls /api/orders/mine
 * until the new order appears (webhook usually fires within 1-3 seconds)
 * or shows a helpful status message.
 */

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMyOrders } from '@/lib/api';

const MAX_POLLS   = 8;
const POLL_DELAY  = 2000; // ms

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const status = searchParams.get('status');       // "successful" | "cancelled" | "failed"
  const txRef  = searchParams.get('tx_ref');       // "DF-<userId>-<productId>-<ts>"

  const [state, setState] = useState('polling');   // "polling" | "confirmed" | "failed"
  const [order, setOrder] = useState(null);
  const polls = useRef(0);

  // Extract productId from txRef: "DF-<userId>-<productId>-<ts>"
  const productId = txRef?.split('-')[2] ?? null;

  useEffect(() => {
    if (status !== 'successful') {
      setState('failed');
      return;
    }

    let cancelled = false;

    async function poll() {
      if (cancelled || polls.current >= MAX_POLLS) {
        if (!cancelled) setState('failed');
        return;
      }
      polls.current += 1;
      try {
        const orders = await getMyOrders();
        const match  = orders.find((o) =>
          o.product?._id === productId || o.product?.slug
        );
        if (match) {
          setOrder(match);
          setState('confirmed');
          return;
        }
      } catch {
        // ignore — keep polling
      }
      setTimeout(poll, POLL_DELAY);
    }

    // Give the webhook a head start before first poll
    setTimeout(poll, 1500);
    return () => { cancelled = true; };
  }, [status, productId]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto text-center space-y-6 pt-16">

      {state === 'polling' && (
        <>
          <Spinner />
          <h1 className="text-xl font-bold text-white">Confirming your payment…</h1>
          <p className="text-gray-400 text-sm">This usually takes just a few seconds.</p>
        </>
      )}

      {state === 'confirmed' && (
        <>
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold text-white">Purchase confirmed!</h1>
          <p className="text-gray-300 text-sm">
            {order?.product?.title} is now in your library.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/dashboard" className="btn-primary">
              Go to My Library
            </Link>
            <Link href="/" className="btn-secondary">
              Browse More
            </Link>
          </div>
        </>
      )}

      {state === 'failed' && (
        <>
          <div className="text-6xl">{status === 'cancelled' ? '🚫' : '❌'}</div>
          <h1 className="text-2xl font-bold text-white">
            {status === 'cancelled' ? 'Payment cancelled' : 'Payment not confirmed'}
          </h1>
          <p className="text-gray-400 text-sm">
            {status === 'cancelled'
              ? 'You cancelled the payment. No charge was made.'
              : 'We couldn\'t confirm your payment. If you were charged, please check your library or contact support.'}
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/dashboard" className="btn-secondary">
              Check My Library
            </Link>
            <Link href="/" className="btn-primary">
              Back to Store
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center">
      <div className="h-12 w-12 rounded-full border-4 border-gray-700
                       border-t-brand-500 animate-spin" />
    </div>
  );
}
