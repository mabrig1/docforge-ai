'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <nav className="border-b border-gray-800 bg-gray-950 sticky top-0 z-50">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
            <span className="text-slate-900 font-black text-lg leading-none">M</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-white hidden sm:block">
            store.<span className="text-blue-400">mabrigkorie.org</span>
          </span>
        </Link>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 text-sm">
          {!loading && (
            <>
              {user ? (
                <>
                  <Link href="/dashboard"
                    className="px-3 py-1.5 rounded-lg text-gray-300 hover:text-white
                               hover:bg-gray-800 transition">
                    My Library
                  </Link>
                  {user.role === 'admin' && (
                    <Link href="/admin"
                      className="px-3 py-1.5 rounded-lg text-blue-400 hover:text-blue-300
                                 hover:bg-gray-800 transition">
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={logout}
                    className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white
                               hover:bg-gray-800 transition">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login"  className="btn-secondary !py-1.5 !px-4">Login</Link>
                  <Link href="/signup" className="btn-primary  !py-1.5 !px-4">Sign Up</Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
