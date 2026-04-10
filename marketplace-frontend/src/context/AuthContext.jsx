'use client';

/**
 * AuthContext — global auth state for the marketplace.
 *
 * Provides:
 *   user        — null | User object
 *   loading     — true while the initial /api/auth/me fetch is in flight
 *   login()     — calls API login, updates user state
 *   signup()    — calls API signup, updates user state
 *   logout()    — clears token + user, redirects to /
 *
 * Usage:
 *   const { user, login, logout } = useAuth();
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Rehydrate session on mount
  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.getMe()
      .then(setUser)
      .catch(() => api.clearToken())   // token invalid/expired — discard
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const u = await api.login(credentials);
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (data) => {
    const u = await api.signup(data);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
    router.push('/');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
