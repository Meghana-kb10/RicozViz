'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdminAuth } from '../../../../context/AdminAuthContext';
import { BrandLogo } from '@repo/components';
import { KeyRound, ShieldAlert, ArrowLeft, ArrowRight, LifeBuoy } from 'lucide-react';

function AdminTwoFactorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/overview';

  const { login } = useAdminAuth();
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [useBackupMode, setUseBackupMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('rv_admin_pending_auth');
      if (stored) {
        setCredentials(JSON.parse(stored));
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials) return;

    if (!useBackupMode && totpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (useBackupMode && backupCode.trim().length !== 8) {
      setError('Backup codes must be 8 characters long.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        email: credentials.email,
        password: credentials.password
      };

      if (useBackupMode) {
        payload.backupCode = backupCode.trim().toLowerCase();
      } else {
        payload.totpCode = totpCode.trim();
      }

      const res = await login(payload);

      if (res.success) {
        sessionStorage.removeItem('rv_admin_pending_auth');
        router.push(returnUrl);
      } else {
        setError(res.error || 'Invalid two-factor authentication code.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex justify-center mb-2">
            <BrandLogo size={40} showText />
          </div>
          <span className="bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded tracking-widest uppercase">
            TWO-FACTOR VERIFICATION
          </span>
          <p className="text-xs text-gray-400">
            {useBackupMode
              ? 'Enter an unused emergency backup code generated during enrollment'
              : 'Enter the 6-digit code from your authenticator application'}
          </p>
        </div>

        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ff6b35] to-transparent opacity-80" />

          {error && (
            <div className="mb-6 p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-200 text-xs">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Verification Failed</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!useBackupMode ? (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2" htmlFor="totp-code">
                  Authenticator Security Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="totp-code"
                    name="totpCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-9 pr-3.5 py-2.5 text-center tracking-[0.5em] text-lg font-mono bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35] transition"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2" htmlFor="backup-code">
                  8-Character Backup Code
                </label>
                <div className="relative">
                  <LifeBuoy className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="backup-code"
                    name="backupCode"
                    type="text"
                    maxLength={8}
                    autoFocus
                    required
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    placeholder="a1b2c3d4"
                    className="w-full pl-9 pr-3.5 py-2.5 text-center tracking-[0.25em] text-sm font-mono bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35] transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-[#ff6b35] hover:bg-[#ff7d4d] text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b35]/20 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validating Code...</span>
                </>
              ) : (
                <>
                  <span>Verify & Access Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#222222] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setUseBackupMode(!useBackupMode);
              }}
              className="text-gray-400 hover:text-white transition cursor-pointer"
            >
              {useBackupMode ? '← Use Authenticator app' : 'Lost device? Use backup code'}
            </button>

            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem('rv_admin_pending_auth');
                router.push('/login');
              }}
              className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-300 transition cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Login</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminTwoFactorLoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <AdminTwoFactorForm />
    </React.Suspense>
  );
}
