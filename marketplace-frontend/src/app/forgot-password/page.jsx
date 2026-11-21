'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await requestPasswordReset(email);
      setMessage(response.message);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pt-10 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Recover your account</h1>
        <p className="text-gray-400 text-sm mt-1">Get a secure password reset link by email.</p>
      </div>
      <form onSubmit={submit} className="card space-y-4">
        <label htmlFor="email" className="block text-sm font-medium text-gray-300">Account email</label>
        <input id="email" type="email" className="input" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        {message && <p role="status" className="text-sm text-green-400">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Requesting link…' : 'Email me a reset link'}
        </button>
      </form>
      <p className="text-center text-sm"><Link href="/login" className="text-brand-400 hover:underline">Return to login</Link></p>
    </div>
  );
}
