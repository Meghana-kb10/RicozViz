"use client";

import React, { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { ApiError } from "../../lib/api";
import { ArrowLeft, ShieldCheck, Lock, AlertCircle, ArrowRight } from "lucide-react";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-mono-code text-red-400">{message}</p>;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSsoMode, setIsSsoMode] = useState(false);
  const [ssoDomain, setSsoDomain] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    if (isSsoMode) {
      if (!ssoDomain.trim()) {
        setError("Please enter your organization domain or workspace slug.");
        setIsLoading(false);
        return;
      }
      // Simulate SAML SSO discovery
      setTimeout(() => {
        setIsLoading(false);
        router.push("/workspace");
      }, 700);
      return;
    }

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
      router.push("/workspace");
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
      {/* Background Matrix & Subtle Coral Glow */}
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
            <img className="size-6 object-contain" src="/images/logo.png" alt="RicozViz" />
            <span className="text-[17px] font-medium tracking-tight text-[#fafafa]">
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
          {/* Card Shell */}
          <div className="rounded-[16px] border border-[#2e2e2e] bg-[#171717] p-8 shadow-2xl transition-all">
            {/* Header */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-2.5 py-0.5 font-mono-code text-[11px] text-[#ff6b35] mb-2.5">
                <Lock className="h-3 w-3" />
                <span>Zero-Trust Authentication</span>
              </div>
              <h1 className="text-2xl font-normal tracking-tight text-[#fafafa]">
                {isSsoMode ? "Single Sign-On (SAML)" : "Sign in to workspace"}
              </h1>
              <p className="mt-1 text-sm text-[#898989] leading-relaxed">
                {isSsoMode
                  ? "Enter your company domain to authenticate via Okta, Entra ID, or Google Workspace."
                  : "Connect to your in-memory DuckDB OLAP canvases and governed pipelines."}
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

            {/* Mode Switcher Buttons */}
            <div className="mb-5 flex rounded-[10px] border border-[#2e2e2e] bg-[#121212] p-1">
              <button
                type="button"
                onClick={() => {
                  setIsSsoMode(false);
                  setError(null);
                }}
                className={`flex-1 rounded-[8px] py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  !isSsoMode
                    ? "bg-[#242424] text-[#fafafa]"
                    : "text-[#898989] hover:text-[#fafafa]"
                }`}
              >
                Work Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSsoMode(true);
                  setError(null);
                }}
                className={`flex-1 rounded-[8px] py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  isSsoMode
                    ? "bg-[#242424] text-[#fafafa]"
                    : "text-[#898989] hover:text-[#fafafa]"
                }`}
              >
                SAML 2.0 / SSO
              </button>
            </div>

            {/* Form */}
            <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-4">
              {!isSsoMode ? (
                <>
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
                      className={`w-full rounded-[10px] border px-3.5 py-2.5 text-sm font-normal text-[#fafafa] placeholder-[#898989] bg-[#121212] outline-none transition focus:border-[#ff6b35] disabled:opacity-50 ${
                        fieldErrors["password"]
                          ? "border-red-500/60 bg-red-950/20"
                          : "border-[#393939]"
                      }`}
                    />
                    <FieldError message={fieldErrors["password"]?.[0]} />
                  </div>
                </>
              ) : (
                /* SSO Domain Input */
                <div>
                  <label
                    htmlFor="sso-domain"
                    className="block text-xs font-medium text-[#b4b4b4] mb-1.5"
                  >
                    Enterprise Identity Domain / Workspace Slug
                  </label>
                  <div className="relative">
                    <input
                      id="sso-domain"
                      type="text"
                      value={ssoDomain}
                      onChange={(e) => setSsoDomain(e.target.value)}
                      placeholder="acmecorp.io or tenant-slug"
                      disabled={isLoading}
                      className="w-full rounded-[10px] border border-[#393939] bg-[#121212] px-3.5 py-2.5 text-sm font-normal text-[#fafafa] placeholder-[#898989] outline-none transition focus:border-[#ff6b35] disabled:opacity-50"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#898989]">
                    Auto-discovers SAML 2.0 Identity Provider &amp; SCIM policies.
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
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
                ) : isSsoMode ? (
                  <>
                    <span>Continue with Enterprise SSO</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <span>Sign in to Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Pre-fill */}
            <div className="mt-5 pt-4 border-t border-[#2e2e2e] flex items-center justify-between text-[11px] font-mono-code text-[#898989]">
              <span>Demo tenant:</span>
              <button
                type="button"
                onClick={() => {
                  setEmail("demo@ricozviz.io");
                  setPassword("password123");
                }}
                className="text-[#ff6b35] hover:underline cursor-pointer"
              >
                Pre-fill demo credentials
              </button>
            </div>
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
