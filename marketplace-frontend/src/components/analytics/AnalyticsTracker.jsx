'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/api';

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    const sessionKey = `mkt_page_view:${pathname}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');

    trackPageView(pathname).catch(() => {
      // Analytics must never interrupt browsing or purchasing.
      sessionStorage.removeItem(sessionKey);
    });
  }, [pathname]);

  return null;
}
