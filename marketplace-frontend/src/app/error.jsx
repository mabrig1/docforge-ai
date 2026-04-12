'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-5">
      <p className="text-6xl">⚠️</p>
      <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
      <p className="text-gray-400 max-w-sm text-sm">
        {error?.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn-primary">Try again</button>
        <a href="/" className="btn-secondary">Back to Store</a>
      </div>
    </div>
  );
}
