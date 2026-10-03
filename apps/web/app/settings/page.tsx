"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";

export default function SettingsPage() {
  const { auth, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading settings…</p>
        </div>
      </div>
    );
  }

  if (!auth) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/workspace" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-sm">
              R
            </div>
            <span className="font-semibold text-gray-900">RicozViz</span>
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-700">Account Settings</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/workspace"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Workspace
          </Link>
          <button
            onClick={() => void logout().then(() => router.push("/login"))}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">User & Organization Settings</h1>

        <div className="space-y-6">
          {/* User profile card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">User Profile</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{auth.user.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Email Address</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{auth.user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Account Status</dt>
                <dd className="mt-1 text-sm font-medium text-emerald-700">{auth.user.status}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Role</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{auth.role}</dd>
              </div>
            </dl>
          </div>

          {/* Organization card */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Organization</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500">Organization Name</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{auth.organization.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Slug</dt>
                <dd className="mt-1 text-sm font-mono text-gray-700">{auth.organization.slug}</dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
