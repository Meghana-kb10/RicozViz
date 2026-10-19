"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../contexts/auth-context";
import { useTheme, type Theme } from "../../contexts/theme-context";
import { AppShell } from "../../components/shell/AppShell";
import { Sun, Moon, Monitor, Check, User, Building2, ShieldCheck, Palette } from "lucide-react";

export default function SettingsPage() {
  const { auth, isLoading, logout } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !auth) {
      void router.replace("/login");
    }
  }, [auth, isLoading, router]);

  if (isLoading || !auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
          <p className="text-xs font-mono-code text-[#898989]">Loading user settings…</p>
        </div>
      </div>
    );
  }

  const themeOptions: Array<{ id: Theme; label: string; icon: typeof Sun; desc: string }> = [
    {
      id: "dark",
      label: "Obsidian Dark",
      icon: Moon,
      desc: "Default high-contrast precision dark canvas (#121212) with coral highlights",
    },
    {
      id: "light",
      label: "Precision Light",
      icon: Sun,
      desc: "Crisp architectural light canvas with calibrated borders",
    },
    {
      id: "system",
      label: "System Automatic",
      icon: Monitor,
      desc: "Synchronizes automatically with device OS color preference",
    },
  ];

  return (
    <AppShell
      title="User & Organization Settings"
      subtitle="Manage theme preferences, identity profile, and enterprise tenant metadata."
      breadcrumbs={[
        { label: "Governance", href: "/workspace" },
        { label: "Settings" },
      ]}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Appearance & Theme Preferences */}
        <div className="rounded-2xl border border-[#242424] bg-[#141414] p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#fafafa] flex items-center gap-2">
                <Palette className="h-4 w-4 text-[#ff6b35]" />
                <span>Appearance & Theme Engine</span>
              </h2>
              <p className="text-xs text-[#898989] font-mono-code mt-0.5">
                Active appearance resolution:{" "}
                <span className="font-bold text-[#ff6b35] uppercase">{resolvedTheme}</span>
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
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-[#ff6b35] bg-[#ff6b35]/15 ring-1 ring-[#ff6b35]/40 shadow-lg shadow-[#ff6b35]/5"
                      : "border-[#242424] bg-[#181818] hover:border-[#2e2e2e] text-[#898989] hover:text-[#fafafa]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className={`p-2 rounded-lg ${isSelected ? "bg-[#ff6b35] text-white" : "bg-[#141414] text-[#898989]"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-[#ff6b35] text-white flex items-center justify-center">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold font-mono-code text-[#fafafa]">{opt.label}</span>
                  <span className="text-[11px] text-[#898989] mt-1.5 leading-relaxed">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* User profile card */}
        <div className="rounded-2xl border border-[#242424] bg-[#141414] p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-[#fafafa] flex items-center gap-2">
            <User className="h-4 w-4 text-[#ff6b35]" />
            <span>Operator Identity</span>
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 font-mono-code text-xs">
            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <dt className="text-[#666666] text-[11px] uppercase tracking-wider">Name</dt>
              <dd className="mt-1 font-semibold text-[#fafafa]">{auth.user.name}</dd>
            </div>
            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <dt className="text-[#666666] text-[11px] uppercase tracking-wider">Email Address</dt>
              <dd className="mt-1 font-semibold text-[#fafafa]">{auth.user.email}</dd>
            </div>
            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <dt className="text-[#666666] text-[11px] uppercase tracking-wider">Account Status</dt>
              <dd className="mt-1 font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>{auth.user.status}</span>
              </dd>
            </div>
            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <dt className="text-[#666666] text-[11px] uppercase tracking-wider">Assigned Role</dt>
              <dd className="mt-1 font-bold text-[#ff6b35]">{auth.role}</dd>
            </div>
          </dl>
        </div>

        {/* Organization card */}
        <div className="rounded-2xl border border-[#242424] bg-[#141414] p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-[#fafafa] flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#ff6b35]" />
            <span>Organization Tenant</span>
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 font-mono-code text-xs">
            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <dt className="text-[#666666] text-[11px] uppercase tracking-wider">Organization Name</dt>
              <dd className="mt-1 font-semibold text-[#fafafa]">{auth.organization.name}</dd>
            </div>
            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <dt className="text-[#666666] text-[11px] uppercase tracking-wider">Tenant Identifier / Slug</dt>
              <dd className="mt-1 font-semibold text-[#fafafa]">/{auth.organization.slug}</dd>
            </div>
          </dl>
        </div>
      </div>
    </AppShell>
  );
}
