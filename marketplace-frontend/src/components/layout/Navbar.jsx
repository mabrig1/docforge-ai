'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <nav className="border-b border-gray-800 bg-gray-950 sticky top-0 z-50">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        {/* Brand */}
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          DocForge <span className="text-brand-400">Market</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-2 text-sm">
          <Link href="/?type=book"
            className="px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition">
            Books
          </Link>
          <Link href="/?type=audio"
            className="px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition">
            Music
          </Link>

          {!loading && (
            <>
              {user ? (
                <>
                  <Link href="/dashboard"
                    className="px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition">
                    My Library
                  </Link>
                  {user.role === 'admin' && (
                    <Link href="/admin"
                      className="px-3 py-1.5 rounded-lg text-brand-400 hover:text-brand-300 hover:bg-gray-800 transition">
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={logout}
                    className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-secondary !py-1.5 !px-4">Login</Link>
                  <Link href="/signup" className="btn-primary !py-1.5 !px-4">Sign Up</Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
