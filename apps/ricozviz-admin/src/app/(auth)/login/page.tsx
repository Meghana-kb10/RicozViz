'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { BrandLogo } from '@repo/components';
import { ShieldCheck, AlertCircle, Lock, Mail, ArrowRight } from 'lucide-react';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/overview';

  const { login, isLoading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await login({ email, password });
      if (res.requires2Fa) {
        // Redirect to 2FA step
        sessionStorage.setItem('rv_admin_pending_auth', JSON.stringify({ email, password }));
        router.push(`/login/2fa?returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      if (res.success) {
        router.push(returnUrl);
        return;
      }

      if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Security boundary header */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex justify-center mb-2">
            <BrandLogo size={40} showText />
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded tracking-widest uppercase">
              PLATFORM OPERATOR PORTAL
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Restricted access. All platform operations are monitored and cryptographically audited.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ff6b35] to-transparent opacity-80" />

          {error && (
            <div className="mb-6 p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Authentication Blocked</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5" htmlFor="admin-email">
                Operator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ricozviz.internal"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35] transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-300" htmlFor="admin-password">
                  Master Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-[#ff6b35] hover:bg-[#ff7d4d] text-white text-xs font-semibold rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b35]/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Operator</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#222222] flex items-center justify-center gap-2 text-[11px] text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>FIPS-compliant HMAC SHA-256 tokens</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <AdminLoginForm />
    </React.Suspense>
  );
}
