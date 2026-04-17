'use client';

/**
 * /payment/callback
 *
 * Flutterwave: ?provider=flutterwave&status=successful|cancelled&tx_ref=...
 * Paystack:    ?provider=paystack&reference=...
 * PayPal:      ?provider=paypal&token=<paypalOrderId>&PayerID=...
 *              or ?provider=paypal&status=cancelled
 */

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getMyOrders, capturePaypalOrder } from '@/lib/api';

const MAX_POLLS  = 10;
const POLL_DELAY = 2000;

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams();

  const provider  = searchParams.get('provider') ?? 'flutterwave';
  const status    = searchParams.get('status');

  // Provider-specific params
  const flwStatus = provider === 'flutterwave' ? status : null;
  const txRef     = searchParams.get('tx_ref');
  const pskRef    = searchParams.get('reference') ?? searchParams.get('trxref');
  const ppToken   = searchParams.get('token');   // PayPal order ID

  const [state, setState] = useState('polling');
  const [order, setOrder] = useState(null);
  const polls = useRef(0);
  const captured = useRef(false);

  const isCancelled = status === 'cancelled';
  const isDefiniteFail =
    (provider === 'flutterwave' && flwStatus && flwStatus !== 'successful') ||
    (provider === 'paypal' && isCancelled);

  useEffect(() => {
    if (isDefiniteFail) {
      setState('failed');
      return;
    }

    let stopped = false;

    async function run() {
      // PayPal: capture first, then poll
      if (provider === 'paypal' && ppToken && !captured.current) {
        captured.current = true;
        try {
          await capturePaypalOrder(ppToken);
        } catch (e) {
          if (!stopped) setState('failed');
          return;
        }
      }

      poll();
    }

    async function poll() {
      if (stopped || polls.current >= MAX_POLLS) {
        if (!stopped) setState('failed');
        return;
      }
      polls.current += 1;

      try {
        const orders = await getMyOrders();

        const ref = provider === 'paystack' ? pskRef
                  : provider === 'paypal'   ? ppToken
                  : txRef;

        const match = orders.find((o) =>
          o.flutterwaveTxRef   === ref ||
          o.paystackReference  === ref ||
          o.paypalOrderId      === ref
        );

        if (match) {
          setOrder(match);
          setState('confirmed');
          return;
        }
      } catch {
        // keep polling
      }

      setTimeout(poll, POLL_DELAY);
    }

    setTimeout(run, provider === 'paypal' ? 500 : 1800);
    return () => { stopped = true; };
  }, [isDefiniteFail, provider, txRef, pskRef, ppToken]);

  const providerName = provider === 'paystack' ? 'Paystack'
                     : provider === 'paypal'   ? 'PayPal'
                     : 'Flutterwave';

  return (
    <div className="max-w-md mx-auto text-center space-y-6 pt-16">

      {state === 'polling' && (
        <>
          <Spinner />
          <h1 className="text-xl font-bold text-white">Confirming your payment…</h1>
          <p className="text-gray-400 text-sm">
            {provider === 'paypal'
              ? 'Capturing your PayPal payment…'
              : `Waiting for ${providerName} to confirm. This usually takes a few seconds.`}
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
          <div className="text-6xl">{isCancelled ? '🚫' : '❌'}</div>
          <h1 className="text-2xl font-bold text-white">
            {isCancelled ? 'Payment cancelled' : 'Payment not confirmed'}
          </h1>
          <p className="text-gray-400 text-sm">
            {isCancelled
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
