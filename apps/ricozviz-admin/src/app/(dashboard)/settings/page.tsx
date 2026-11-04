'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import {
  apiAdminChangePassword,
  apiAdminForceLogoutUser,
  apiAdminRegenerateBackupCodes,
  apiAdminListSessions,
  apiAdminRevokeSession,
  type AdminSessionItem
} from '@repo/api';
import { ConfirmDialog, useToast } from '@repo/components';
import {
  Settings,
  Lock,
  KeyRound,
  ShieldCheck,
  LogOut,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Copy,
  Download,
  Laptop,
  Check,
  Shield,
  Trash2
} from 'lucide-react';

export default function AdminSettingsPage() {
  const { user, logout } = useAdminAuth();
  const router = useRouter();
  const { showToast } = useToast();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Global Logout Dialog State
  const [isGlobalLogoutOpen, setIsGlobalLogoutOpen] = useState(false);
  const [globalLogoutLoading, setGlobalLogoutLoading] = useState(false);

  // Backup codes regeneration modal state
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [totpPromptCode, setTotpPromptCode] = useState('');
  const [backupRegenError, setBackupRegenError] = useState<string | null>(null);
  const [backupRegenLoading, setBackupRegenLoading] = useState(false);
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState<string[] | null>(null);
  const [hasAcknowledgedCodes, setHasAcknowledgedCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Active Sessions state
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionToRevoke, setSessionToRevoke] = useState<AdminSessionItem | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await apiAdminListSessions();
      setSessions(res.sessions || []);
    } catch {
      // Non-blocking error for sessions list
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 12) {
      setPasswordError('New password must be at least 12 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password confirmation does not match.');
      return;
    }

    setPasswordSubmitting(true);
    try {
      await apiAdminChangePassword({
        currentPassword,
        newPassword
      });

      showToast({
        type: 'success',
        title: 'Password Updated',
        message: 'Your platform operator password has been successfully updated.'
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password. Verify your current password.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleGlobalLogout = async () => {
    if (!user) return;
    setGlobalLogoutLoading(true);
    try {
      await apiAdminForceLogoutUser(user.id);
      showToast({
        type: 'info',
        title: 'All Sessions Terminated',
        message: 'All platform operator refresh tokens and sessions have been revoked.'
      });
      await logout();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to revoke sessions' });
      setGlobalLogoutLoading(false);
    }
  };

  const handleOpenRegenerateModal = () => {
    setTotpPromptCode('');
    setBackupRegenError(null);
    setGeneratedBackupCodes(null);
    setHasAcknowledgedCodes(false);
    setCopiedCodes(false);
    setIsBackupModalOpen(true);
  };

  const handleRegenerateBackupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpPromptCode.trim().length !== 6) {
      setBackupRegenError('Please enter your 6-digit TOTP verification code.');
      return;
    }

    setBackupRegenError(null);
    setBackupRegenLoading(true);

    try {
      const res = await apiAdminRegenerateBackupCodes({ totpCode: totpPromptCode.trim() });
      setGeneratedBackupCodes(res.backupCodes || []);
      showToast({
        type: 'warning',
        title: 'Backup Codes Regenerated',
        message: '10 fresh emergency backup codes generated. Save them before closing.'
      });
    } catch (err: any) {
      setBackupRegenError(err.message || 'Failed to regenerate backup codes. Verify your authenticator code.');
    } finally {
      setBackupRegenLoading(false);
    }
  };

  const handleCopyBackupCodes = () => {
    if (!generatedBackupCodes) return;
    navigator.clipboard.writeText(generatedBackupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2500);
    showToast({ type: 'info', message: 'Backup codes copied to clipboard.' });
  };

  const handleDownloadBackupCodes = () => {
    if (!generatedBackupCodes) return;
    const content = `RICOZVIZ PLATFORM OPERATOR BACKUP CODES\nAccount: ${user?.email || 'admin'}\nDate: ${new Date().toISOString()}\n\nEach code can be used exactly once to bypass TOTP:\n\n${generatedBackupCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nKeep this file in a secure, encrypted vault.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ricozviz-admin-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRevokeSession = async () => {
    if (!sessionToRevoke) return;
    setRevokeLoading(true);
    try {
      await apiAdminRevokeSession(sessionToRevoke.id);
      showToast({
        type: 'success',
        title: 'Session Revoked',
        message: `Session from ${sessionToRevoke.ipAddress} has been terminated.`
      });
      setSessionToRevoke(null);
      fetchSessions();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Failed to revoke session' });
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-[#222]">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          <h1 className="text-xl font-bold tracking-tight text-white font-mono">
            Platform Operator Settings
          </h1>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Manage master administrative credentials, TOTP keypair rotation, and session invalidation.
        </p>
      </div>

      {/* 1. Change Password */}
      <div className="p-6 bg-[#141414] border border-[#242424] rounded-2xl space-y-5 shadow-xl">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#222]">
          <Lock className="w-4 h-4 text-[#ff6b35]" />
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Change Master Password
            </h2>
            <p className="text-[11px] text-gray-400">
              Requires min. 12 characters. Changes take effect across all nodes immediately.
            </p>
          </div>
        </div>

        {passwordError && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-red-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1" htmlFor="current-pw">
              Current Password
            </label>
            <input
              id="current-pw"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1" htmlFor="new-pw">
              New Master Password (min. 12 characters)
            </label>
            <input
              id="new-pw"
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1" htmlFor="confirm-pw">
              Confirm New Master Password
            </label>
            <input
              id="confirm-pw"
              type="password"
              required
              minLength={12}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35]"
            />
          </div>

          <button
            type="submit"
            disabled={passwordSubmitting}
            className="py-2.5 px-4 bg-[#ff6b35] hover:bg-[#ff7d4d] text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b35]/20 disabled:opacity-50 cursor-pointer"
          >
            {passwordSubmitting ? 'Updating Password...' : 'Update Master Password'}
          </button>
        </form>
      </div>

      {/* 2. Two-Factor Authentication Status & Backup Codes */}
      <div className="p-6 bg-[#141414] border border-[#242424] rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#222]">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Two-Factor Authentication (RFC 6238 TOTP)
              </h2>
              <p className="text-[11px] text-gray-400">
                AES-256 encrypted credential vault storage with single-use backup codes.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            ACTIVE
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <p className="text-xs text-gray-400 leading-relaxed max-w-lg">
            Re-enrolling regenerates a new cryptographic secret key. You can also regenerate 10 fresh emergency backup codes without altering your authenticator app.
          </p>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenRegenerateModal}
              className="px-3.5 py-2 text-xs font-mono font-medium text-[#ff6b35] hover:text-[#ff8252] bg-[#ff6b35]/10 hover:bg-[#ff6b35]/20 border border-[#ff6b35]/30 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate Backup Codes</span>
            </button>

            <Link
              href="/enroll-2fa"
              className="px-4 py-2 text-xs font-mono font-medium text-white bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Re-Enroll Authenticator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Active Operator Sessions */}
      <div className="p-6 bg-[#141414] border border-[#242424] rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#222]">
          <div className="flex items-center gap-2.5">
            <Laptop className="w-4 h-4 text-[#ff6b35]" />
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Active Operator Sessions
              </h2>
              <p className="text-[11px] text-gray-400">
                Connected devices and refresh sessions authorized to access platform administration.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchSessions}
            disabled={sessionsLoading}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1f1f1f] transition cursor-pointer"
            title="Refresh sessions list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {sessionsLoading ? (
          <div className="py-6 flex justify-center text-xs text-gray-500 font-mono">
            Loading active sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-500 font-mono">
            No active sessions found.
          </div>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#0d0d0d] border border-[#222] rounded-xl gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#191919] border border-[#2b2b2b] rounded-lg mt-0.5 shrink-0">
                    <Laptop className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-white">
                        {sess.ipAddress}
                      </span>
                      {sess.isCurrent && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                          Current Session
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 max-w-md truncate font-mono">
                      {sess.userAgent}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono">
                      Started: {new Date(sess.createdAt).toLocaleString()} • Last active:{' '}
                      {new Date(sess.lastUsedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {!sess.isCurrent && (
                  <button
                    type="button"
                    onClick={() => setSessionToRevoke(sess)}
                    className="self-end sm:self-center px-3 py-1.5 text-xs font-mono font-medium text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-800/30 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Global Invalidation ("Sign out everywhere") */}
      <div className="p-6 bg-[#141414] border border-[#242424] rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#222]">
          <LogOut className="w-4 h-4 text-red-400" />
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Global Session Invalidation
            </h2>
            <p className="text-[11px] text-gray-400">
              Revoke all active operator sessions, mobile devices, and browser tokens globally.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <p className="text-xs text-gray-400 leading-relaxed max-w-lg">
            This immediately increments your operator <span className="font-mono text-white">tokenVersion</span> in MongoDB.
            Any current or stolen refresh tokens will fail replay detection and become unusable.
          </p>

          <button
            type="button"
            onClick={() => setIsGlobalLogoutOpen(true)}
            className="px-4 py-2 text-xs font-mono font-semibold text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 border border-red-800/40 rounded-xl transition cursor-pointer shrink-0"
          >
            Sign Out Everywhere
          </button>
        </div>
      </div>

      {/* Regenerate Backup Codes Modal */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <div className="flex items-center gap-2 text-white font-mono font-bold text-sm">
                <Shield className="w-4 h-4 text-[#ff6b35]" />
                <span>Regenerate Emergency Backup Codes</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {generatedBackupCodes
                  ? 'Store these 10 single-use recovery codes in a secure credential vault.'
                  : 'Enter your 6-digit authenticator app code to authorize regenerating backup codes.'}
              </p>
            </div>

            {backupRegenError && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{backupRegenError}</span>
              </div>
            )}

            {!generatedBackupCodes ? (
              <form onSubmit={handleRegenerateBackupCodes} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1" htmlFor="totp-code">
                    6-Digit Authenticator Code
                  </label>
                  <input
                    id="totp-code"
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="000000"
                    value={totpPromptCode}
                    onChange={(e) => setTotpPromptCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-center text-lg tracking-[0.3em] font-mono bg-[#0d0d0d] border border-[#2b2b2b] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b35]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222]">
                  <button
                    type="button"
                    onClick={() => setIsBackupModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs text-gray-400 hover:text-white transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={backupRegenLoading || totpPromptCode.length !== 6}
                    className="px-4 py-2 text-xs font-semibold bg-[#ff6b35] hover:bg-[#ff7d4d] text-white rounded-xl transition disabled:opacity-50 cursor-pointer"
                  >
                    {backupRegenLoading ? 'Verifying...' : 'Authorize & Generate'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#0a0a0a] border border-[#222] rounded-xl">
                  {generatedBackupCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1.5 text-center font-mono text-xs text-gray-200 bg-[#141414] border border-[#2b2b2b] rounded-lg tracking-widest selection:bg-[#ff6b35]/30 select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBackupCodes}
                    className="flex-1 py-1.5 px-3 text-xs font-mono text-gray-300 hover:text-white bg-[#1f1f1f] hover:bg-[#282828] border border-[#333] rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodes ? 'Copied All' : 'Copy All'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadBackupCodes}
                    className="flex-1 py-1.5 px-3 text-xs font-mono text-gray-300 hover:text-white bg-[#1f1f1f] hover:bg-[#282828] border border-[#333] rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download TXT</span>
                  </button>
                </div>

                <label className="flex items-start gap-2.5 pt-2 text-[11px] text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasAcknowledgedCodes}
                    onChange={(e) => setHasAcknowledgedCodes(e.target.checked)}
                    className="mt-0.5 rounded border-[#333] text-[#ff6b35] focus:ring-[#ff6b35] cursor-pointer"
                  />
                  <span>
                    I confirm that I have safely copied or printed these 10 emergency codes. I understand they will never be shown again.
                  </span>
                </label>

                <div className="flex items-center justify-end pt-2 border-t border-[#222]">
                  <button
                    type="button"
                    disabled={!hasAcknowledgedCodes}
                    onClick={() => setIsBackupModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold bg-[#ff6b35] hover:bg-[#ff7d4d] text-white rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Done & Secured
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revoke Specific Session Dialog */}
      {sessionToRevoke && (
        <ConfirmDialog
          isOpen={true}
          title={`Revoke Operator Session: ${sessionToRevoke.ipAddress}`}
          description={`Are you sure you want to terminate this session? The device using this refresh token will be immediately disconnected.`}
          confirmLabel="Revoke Session"
          variant="danger"
          isLoading={revokeLoading}
          onConfirm={handleRevokeSession}
          onCancel={() => setSessionToRevoke(null)}
        />
      )}

      {/* Global Logout Dialog */}
      <ConfirmDialog
        isOpen={isGlobalLogoutOpen}
        title="Revoke All Operator Sessions Everywhere"
        description="This will immediately invalidate all active browser sessions and refresh tokens for your platform admin account. You will need to log in again."
        confirmLabel="Sign Out Everywhere"
        variant="danger"
        isLoading={globalLogoutLoading}
        onConfirm={handleGlobalLogout}
        onCancel={() => setIsGlobalLogoutOpen(false)}
      />
    </div>
  );
}
