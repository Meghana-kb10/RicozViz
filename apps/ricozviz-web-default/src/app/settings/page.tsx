"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useTheme, type Theme } from "../../contexts/theme-context";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { Sun, Moon, Monitor, Check } from "lucide-react";

export default function SettingsPage() {
  const { auth, isLoading, logout } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading settings…</p>
        </div>
      </div>
    );
  }

  if (!auth) return null;

  const themeOptions: Array<{ id: Theme; label: string; icon: typeof Sun; desc: string }> = [
    {
      id: "light",
      label: "Light",
      icon: Sun,
      desc: "Clean light canvas with crisp borders",
    },
    {
      id: "dark",
      label: "Dark",
      icon: Moon,
      desc: "Deep high-contrast palette for low-light focus",
    },
    {
      id: "system",
      label: "System",
      icon: Monitor,
      desc: "Automatically adapts to your device theme",
    },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] flex flex-col transition-colors">
      <header className="border-b border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/workspace" className="flex items-center gap-2">
            <BrandLogo size={32} />
            <span className="font-semibold text-[hsl(var(--foreground))]">RicozViz</span>
          </Link>
          <span className="text-[hsl(var(--surface-border))]">/</span>
          <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Account Settings</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/workspace"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Workspace
          </Link>
          <button
            onClick={() => void logout().then(() => router.push("/login"))}
            className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] mb-6">User & Organization Settings</h1>

        <div className="space-y-6">
          {/* Appearance & Theme Preferences */}
          <div className="rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Appearance & Theme</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Customize your interface visual preference across the entire workspace. Active mode:{" "}
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 capitalize">{resolvedTheme}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-600/30 dark:ring-indigo-500/30"
                        : "border-[hsl(var(--surface-border))] hover:border-gray-300 dark:hover:border-zinc-700 bg-[hsl(var(--surface))]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-lg ${isSelected ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-[hsl(var(--muted-foreground))]"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {isSelected && (
                        <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-bold text-[hsl(var(--foreground))]">{opt.label}</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User profile card */}
          <div className="rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-4">User Profile</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</dt>
                <dd className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">{auth.user.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Email Address</dt>
                <dd className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">{auth.user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Account Status</dt>
                <dd className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">{auth.user.status}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Role</dt>
                <dd className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">{auth.role}</dd>
              </div>
            </dl>
          </div>

          {/* Organization card */}
          <div className="rounded-xl border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))] p-6 shadow-sm">
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-4">Organization</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Organization Name</dt>
                <dd className="mt-1 text-sm font-medium text-[hsl(var(--foreground))]">{auth.organization.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Slug</dt>
                <dd className="mt-1 text-sm font-mono text-[hsl(var(--foreground))]">{auth.organization.slug}</dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
