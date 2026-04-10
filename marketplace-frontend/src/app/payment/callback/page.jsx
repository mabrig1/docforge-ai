'use client';

/**
 * /payment/callback
 *
 * Both Flutterwave and Paystack redirect here after a payment attempt.
 *
 * Flutterwave appends:
 *   ?provider=flutterwave&status=successful|cancelled|failed
 *   &tx_ref=DF-FLW-...&transaction_id=<id>
 *
 * Paystack appends:
 *   ?provider=paystack&reference=DF-PSK-...&trxref=DF-PSK-...
 *   (Paystack does NOT include a status param — we treat any redirect as
 *    "payment attempted" and rely on backend verification via polling)
 *
 * Strategy:
 *  - Detect provider from ?provider= param.
 *  - For Flutterwave: if status !== "successful" show failure immediately.
 *  - For Paystack:    always poll (we can't trust the redirect URL alone).
 *  - Poll GET /api/orders/mine up to MAX_POLLS times until a new order appears.
 */

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getMyOrders } from '@/lib/api';

const MAX_POLLS  = 10;
const POLL_DELAY = 2000; // ms

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams();

  const provider    = searchParams.get('provider') ?? 'flutterwave';

  // Flutterwave params
  const flwStatus = searchParams.get('status');       // "successful" | "cancelled" | "failed"
  const txRef     = searchParams.get('tx_ref');

  // Paystack params
  const pskRef    = searchParams.get('reference') ?? searchParams.get('trxref');

  const [state, setState] = useState('polling');   // polling | confirmed | failed
  const [order, setOrder] = useState(null);
  const polls = useRef(0);

  // For Flutterwave, show immediate failure if status is non-successful
  const isDefiniteFail =
    provider === 'flutterwave' && flwStatus && flwStatus !== 'successful';

  useEffect(() => {
    if (isDefiniteFail) {
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

        // Match the order by the reference embedded in txRef/pskRef
        // Format: DF-FLW-<userId>-<productId>-<ts>  or  DF-PSK-<userId>-<productId>-<ts>
        const ref = provider === 'paystack' ? pskRef : txRef;
        const productIdFromRef = ref?.split('-')[3] ?? null;

        const match = orders.find((o) =>
          (o.flutterwaveTxRef === ref) ||
          (o.paystackReference === ref) ||
          (productIdFromRef && o.product?._id === productIdFromRef)
        );

        if (match) {
          setOrder(match);
          setState('confirmed');
          return;
        }
      } catch {
        // ignore, keep polling
      }

      setTimeout(poll, POLL_DELAY);
    }

    // Give the webhook a head start before first poll
    setTimeout(poll, 1800);
    return () => { cancelled = true; };
  }, [isDefiniteFail, provider, txRef, pskRef]);

  const providerName = provider === 'paystack' ? 'Paystack' : 'Flutterwave';

  return (
    <div className="max-w-md mx-auto text-center space-y-6 pt-16">

      {state === 'polling' && (
        <>
          <Spinner />
          <h1 className="text-xl font-bold text-white">Confirming your payment…</h1>
          <p className="text-gray-400 text-sm">
            Waiting for {providerName} to confirm. This usually takes a few seconds.
          </p>
        </>
      )}

      {state === 'confirmed' && (
        <>
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold text-white">Purchase confirmed!</h1>
          <p className="text-gray-300 text-sm">
            {order?.product?.title ?? 'Your product'} is now in your library.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/dashboard" className="btn-primary">Go to My Library</Link>
            <Link href="/"          className="btn-secondary">Browse More</Link>
          </div>
        </>
      )}

      {state === 'failed' && (
        <>
          <div className="text-6xl">
            {flwStatus === 'cancelled' ? '🚫' : '❌'}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {flwStatus === 'cancelled' ? 'Payment cancelled' : 'Payment not confirmed'}
          </h1>
          <p className="text-gray-400 text-sm">
            {flwStatus === 'cancelled'
              ? 'You cancelled the payment. No charge was made.'
              : `We could not confirm your payment via ${providerName}. ` +
                `If you were charged, please check your library or contact support.`}
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/dashboard" className="btn-secondary">Check My Library</Link>
            <Link href="/"          className="btn-primary">Back to Store</Link>
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
