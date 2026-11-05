"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { BrandLogo } from "../../components/shell/BrandLogo";
import { ShieldAlert, Mail, LogOut, ArrowRight, HelpCircle } from "lucide-react";

export default function SuspendedPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-[#fafafa] flex flex-col justify-between selection:bg-[#ff6b35]/20 selection:text-[#ff6b35]">
      {/* Top Header */}
      <header className="border-b border-[#262626] bg-[#121212]/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={32} useSvg />
          <span className="text-sm font-semibold tracking-tight text-[#fafafa]">
            Ricoz<span className="text-[#ff6b35]">Viz</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium border border-red-500/20">
            Account Suspended
          </span>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-1.5 text-xs text-[#898989] hover:text-[#fafafa] transition-colors disabled:opacity-50"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="bg-[#181818] border border-red-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            {/* Subtle top red glow bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-[#ff6b35] to-red-600" />

            {/* Warning Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 text-red-400 shadow-inner">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#fafafa] mb-3">
              Account Suspended
            </h1>
            <p className="text-sm text-[#898989] leading-relaxed mb-6">
              Access to this organization workspace has been suspended by the platform administrator
              or pending administrative review. Active dashboards, API tokens, and dataset syncs are
              temporarily paused.
            </p>

            {/* Diagnostic Information */}
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 mb-6 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-[#898989]">
                <span>Status</span>
                <span className="font-medium text-red-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  SUSPENDED
                </span>
              </div>
              <div className="flex items-center justify-between text-[#898989]">
                <span>Reason</span>
                <span className="text-[#fafafa]">Administrative or billing policy enforcement</span>
              </div>
              <div className="flex items-center justify-between text-[#898989]">
                <span>Restoration</span>
                <span className="text-[#fafafa]">Platform administrator review required</span>
              </div>
            </div>

            {/* Action Steps */}
            <div className="space-y-3 mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#898989]">
                What should you do?
              </h2>
              <ul className="space-y-2 text-xs text-[#b4b4b4]">
                <li className="flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-[#ff6b35] shrink-0 mt-0.5" />
                  <span>
                    Contact your internal workspace administrator or organization IT coordinator to review the suspension.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-[#ff6b35] shrink-0 mt-0.5" />
                  <span>
                    If you are the primary organization owner, contact RicozViz Platform Support directly at{" "}
                    <a
                      href="mailto:support@ricozviz.io?subject=Account%20Suspension%20Inquiry"
                      className="text-[#ff6b35] hover:underline"
                    >
                      support@ricozviz.io
                    </a>.
                  </span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="mailto:support@ricozviz.io?subject=Account%20Suspension%20Inquiry"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff6b35] hover:bg-[#e05a28] text-white text-xs font-semibold tracking-wide transition-all shadow-sm"
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </a>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-[#fafafa] text-xs font-medium transition-all disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {isLoggingOut ? "Signing out..." : "Sign in as different user"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#262626] py-4 px-6 text-center text-xs text-[#898989]">
        RicozViz Enterprise Analytics Platform &middot; Security & Compliance
      </footer>
    </div>
  );
}
