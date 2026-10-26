"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { ApiError } from "../../lib/api";
import { ArrowLeft, Lock, AlertCircle, ArrowRight } from "lucide-react";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-mono-code text-red-400">{message}</p>;
}

export default function LoginPage() {
  const { auth, isLoading: isAuthLoading, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // If already authenticated, redirect immediately to dashboard
  useEffect(() => {
    if (!isAuthLoading && auth) {
      void router.replace("/dashboards");
    }
  }, [auth, isAuthLoading, router]);

  // While verifying session or if already authenticated, do not show login page
  if (isAuthLoading || auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212] text-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff6b35] border-t-transparent" />
          <p className="text-xs font-mono-code text-[#898989]">
            {auth ? "Redirecting to dashboard..." : "Verifying session..."}
          </p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    // Client-side validation
    const newErrors: Record<string, string[]> = {};
    if (!email) newErrors["email"] = ["Work email is required"];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors["email"] = ["Please enter a valid email address"];
    if (!password) newErrors["password"] = ["Password is required"];

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      await login(email, password);
      router.push("/dashboards");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          setFieldErrors(err.details);
        } else {
          const raw = err.message || "";
          const isInternal =
            err.status >= 500 ||
            /prisma|database|localhost|connection|failed to connect|syntax error|sql/i.test(raw);
          if (isInternal) {
            setError("Unable to sign in right now. Please try again.");
          } else {
            setError(raw);
          }
        }
      } else {
        setError("Unable to sign in right now. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#121212] text-[#fafafa] font-sans relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, #333333 1.25px, transparent 1.25px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] z-0 blur-[120px] opacity-15"
        style={{ background: "radial-gradient(circle, #ff6b35 0%, transparent 70%)" }}
      />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full border-b border-[#2e2e2e]/70 px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img className="size-6 rounded-md object-contain" src="/images/logo.png" alt="RicozViz" />
            <span className="text-[17px] font-medium tracking-tight text-[#fafafa] group-hover:text-[#ff6b35] transition-colors">
              ricozviz
            </span>
            <span className="rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-2 py-0.5 font-mono-code text-[10px] text-[#ff6b35]">
              Intelligence OS
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-[#898989] hover:text-[#fafafa] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to website</span>
          </Link>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          {/* Card Shell with Hover Reveal & Glow */}
          <div className="group rounded-[18px] border border-[#2e2e2e] bg-[#171717]/95 backdrop-blur-md p-8 shadow-2xl transition-all duration-300 hover:border-[#ff6b35]/40 hover:shadow-[0_12px_40px_rgba(255,107,53,0.12)]">
            {/* Header */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-2.5 py-0.5 font-mono-code text-[11px] text-[#ff6b35] mb-2.5">
                <Lock className="h-3 w-3" />
                <span>Zero-Trust Authentication</span>
              </div>
              <h1 className="text-2xl font-normal tracking-tight text-[#fafafa]">
                Sign in to workspace
              </h1>
              <p className="mt-1 text-sm text-[#898989] leading-relaxed">
                Connect to your in-memory DuckDB OLAP canvases and governed pipelines.
              </p>
            </div>

            {/* Global Error Alert */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-[10px] border border-red-500/40 bg-red-950/40 p-3.5 text-xs text-red-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-4" suppressHydrationWarning>
              {/* Email Input */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-medium text-[#b4b4b4] mb-1.5"
                >
                  Work Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="architect@enterprise.io"
                  disabled={isLoading}
                  suppressHydrationWarning
                  className={`w-full rounded-[10px] border px-3.5 py-2.5 text-sm font-normal text-[#fafafa] placeholder-[#898989] bg-[#121212] outline-none transition focus:border-[#ff6b35] disabled:opacity-50 ${
                    fieldErrors["email"]
                      ? "border-red-500/60 bg-red-950/20"
                      : "border-[#393939]"
                  }`}
                />
                <FieldError message={fieldErrors["email"]?.[0]} />
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-[#b4b4b4]"
                  >
                    Password
                  </label>
                  <span className="text-[11px] text-[#898989] hover:text-[#ff6b35] transition-colors cursor-pointer">
                    Forgot password?
                  </span>
                </div>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  suppressHydrationWarning
                  className={`w-full rounded-[10px] border px-3.5 py-2.5 text-sm font-normal text-[#fafafa] placeholder-[#898989] bg-[#121212] outline-none transition focus:border-[#ff6b35] disabled:opacity-50 ${
                    fieldErrors["password"]
                      ? "border-red-500/60 bg-red-950/20"
                      : "border-[#393939]"
                  }`}
                />
                <FieldError message={fieldErrors["password"]?.[0]} />
              </div>

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                suppressHydrationWarning
                className="w-full mt-2 flex h-[40px] items-center justify-center gap-2 rounded-full border border-[#ff6b35]/80 bg-[#9a3412] px-4 text-sm font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c] disabled:opacity-60 cursor-pointer shadow-[0_0_20px_rgba(255,107,53,0.18)]"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 text-xs">
                    <svg className="h-4 w-4 animate-spin text-[#fafafa]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating…
                  </span>
                ) : (
                  <>
                    <span>Sign in to Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-[#898989]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-[#ff6b35] hover:text-[#ff8252] transition-colors"
            >
              Launch free workspace →
            </Link>
          </p>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full py-4 text-center text-[11px] font-mono-code text-[#898989] border-t border-[#2e2e2e]/50">
        Cryptographic Row-Level Security · Hardware HSM Enclave · RFC 6962 SHA-256 Ledger
      </footer>
    </div>
  );
}
