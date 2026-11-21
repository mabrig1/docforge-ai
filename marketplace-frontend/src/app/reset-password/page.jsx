'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetAccountPassword } from '@/lib/api';

function ResetPasswordContent() {
  const params = useSearchParams();
  const [token] = useState(() => params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Keep reset tokens out of browser history and subsequent URL sharing.
  useEffect(() => {
    if (token && window.location.search) {
      window.history.replaceState(window.history.state, '', '/reset-password');
    }
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!token) return setError('This link is missing its token. Request a new reset link.');
    if (password.length < 12 || password.length > 128) return setError('Use a password of 12–128 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const result = await resetAccountPassword(token, password);
      setStatus(result.message);
      setPassword('');
      setConfirm('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pt-10 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Set a new password</h1>
        <p className="text-gray-400 text-sm mt-1">Your recovery link works only once and expires in 15 minutes.</p>
      </div>
      {status ? (
        <div className="card space-y-4">
          <p role="status" className="text-green-400">{status}</p>
          <Link href="/login" className="btn-primary block text-center">Log in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4">
          <label htmlFor="password" className="block text-sm font-medium text-gray-300">New password</label>
          <input id="password" className="input" type="password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} maxLength={128} />
          <label htmlFor="confirm" className="block text-sm font-medium text-gray-300">Confirm new password</label>
          <input id="confirm" className="input" type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={12} maxLength={128} />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={loading || !token}>
            {loading ? 'Updating…' : 'Set new password'}
          </button>
        </form>
      )}
      <p className="text-center text-sm"><Link href="/forgot-password" className="text-brand-400 hover:underline">Request another link</Link></p>
    </div>
  );
}
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-gray-400 pt-10">Loading recovery…</p>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
