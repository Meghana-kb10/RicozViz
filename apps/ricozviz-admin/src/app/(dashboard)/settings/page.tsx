'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { apiAdminChangePassword, apiAdminForceLogoutUser } from '@repo/api';
import { ConfirmDialog, useToast } from '@repo/components';
import {
  Settings,
  Lock,
  KeyRound,
  ShieldCheck,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  ArrowRight
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

      {/* 2. Two-Factor Authentication Status & Re-Enrollment */}
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
            Re-enrolling generates a new cryptographic secret key and 10 fresh emergency backup codes.
            Your previous authenticator configuration will be immediately invalidated.
          </p>

          <Link
            href="/enroll-2fa"
            className="px-4 py-2 text-xs font-mono font-medium text-white bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>Re-Enroll Authenticator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 3. Global Invalidation ("Sign out everywhere") */}
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
