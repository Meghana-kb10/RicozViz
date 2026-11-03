'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { QrCodeDisplay } from '../../../components/QrCodeDisplay';
import { BrandLogo } from '@repo/components';
import { ShieldCheck, Copy, Download, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';

export default function AdminEnrollTwoFactorPage() {
  const router = useRouter();
  const { enroll2Fa, verify2Fa } = useAdminAuth();

  const [enrollData, setEnrollData] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  // Backup codes state after successful verify
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [hasSavedCodes, setHasSavedCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    let mounted = true;
    enroll2Fa()
      .then((data) => {
        if (mounted) {
          setEnrollData(data);
          setIsEnrolling(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to initiate 2FA enrollment. Please check admin authorization.');
          setIsEnrolling(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [enroll2Fa]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setError(null);
    setIsVerifying(true);

    try {
      const res = await verify2Fa(totpCode.trim());
      setBackupCodes(res.backupCodes);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyBackupCodes = () => {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    if (!backupCodes) return;
    const content = [
      'RICOZVIZ PLATFORM OPERATOR EMERGENCY BACKUP CODES',
      'Generated: ' + new Date().toISOString(),
      'Each code is single-use only. Store in a secure password vault.',
      '------------------------------------------------------------',
      ...backupCodes
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ricozviz-admin-backup-codes-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex justify-center mb-2">
            <BrandLogo size={40} showText />
          </div>
          <span className="bg-[#ff6b35]/15 text-[#ff6b35] border border-[#ff6b35]/30 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded tracking-widest uppercase">
            MANDATORY 2FA ENROLLMENT
          </span>
          <p className="text-xs text-gray-400">
            Platform operators are required to protect their session with RFC 6238 TOTP 2FA.
          </p>
        </div>

        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#ff6b35] to-transparent opacity-80" />

          {error && (
            <div className="mb-6 p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-3 text-red-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Enrollment Error</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {isEnrolling ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono text-gray-400">Generating cryptographic TOTP keypair...</span>
            </div>
          ) : !backupCodes ? (
            /* Step 1: Scan QR Code & Verify */
            <div className="space-y-6">
              {enrollData && (
                <QrCodeDisplay
                  otpauthUri={enrollData.otpauthUri}
                  secret={enrollData.secret}
                />
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5" htmlFor="verify-code">
                    Enter 6-digit Code from Authenticator to Confirm Setup
                  </label>
                  <input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-3.5 py-2.5 text-center tracking-[0.5em] text-lg font-mono bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35] transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || totpCode.length !== 6}
                  className="w-full py-2.5 px-4 bg-[#ff6b35] hover:bg-[#ff7d4d] text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b35]/20 disabled:opacity-50 cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Token...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Generate Backup Codes</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Step 2: Backup Codes Confirmation */
            <div className="space-y-6">
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-start gap-3 text-emerald-200 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">2FA Successfully Enabled</span>
                  <span>Save your emergency backup codes now. They will not be displayed again.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-[#0d0d0d] border border-[#262626] rounded-xl">
                {backupCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 font-mono text-xs text-center text-gray-200 bg-[#161616] rounded border border-[#222]"
                  >
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyBackupCodes}
                  className="flex-1 py-2 px-3 text-xs font-medium text-gray-300 hover:text-white bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCodes ? 'Copied to Clipboard' : 'Copy All'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBackupCodes}
                  className="flex-1 py-2 px-3 text-xs font-medium text-gray-300 hover:text-white bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .TXT</span>
                </button>
              </div>

              <div className="pt-2 border-t border-[#222] space-y-4">
                <label className="flex items-start gap-2.5 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasSavedCodes}
                    onChange={(e) => setHasSavedCodes(e.target.checked)}
                    className="mt-0.5 rounded border-gray-600 text-[#ff6b35] focus:ring-[#ff6b35]"
                  />
                  <span>
                    I have saved these backup codes in a secure password vault. I understand they will
                    never be shown again.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={!hasSavedCodes}
                  onClick={() => router.push('/overview')}
                  className="w-full py-2.5 px-4 bg-[#ff6b35] hover:bg-[#ff7d4d] text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b35]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Proceed to Operations Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
