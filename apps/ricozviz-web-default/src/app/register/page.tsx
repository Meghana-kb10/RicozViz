"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/auth-context";
import { ApiError } from "../../lib/api";
import { ArrowLeft, ArrowRight, ShieldCheck, Zap, AlertCircle } from "lucide-react";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-mono-code text-red-400">{message}</p>;
}

export default function RegisterPage() {
  const { auth, isLoading: isAuthLoading, register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // If already authenticated, redirect immediately to dashboard
  useEffect(() => {
    if (!isAuthLoading && auth) {
      void router.replace("/dashboards");
    }
  }, [auth, isAuthLoading, router]);

  // While verifying session or if already authenticated, do not show register page
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
    if (!name.trim()) newErrors["name"] = ["Full name is required"];
    if (!organizationName.trim())
      newErrors["organizationName"] = ["Organization name is required"];
    if (!email) newErrors["email"] = ["Work email is required"];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors["email"] = ["Please enter a valid email address"];
    if (!password) newErrors["password"] = ["Password is required"];
    else if (password.length < 8)
      newErrors["password"] = ["Password must be at least 8 characters"];

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      await register({ name, email, password, organizationName });
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
            setError("Unable to create account right now. Please try again.");
          } else {
            setError(raw);
          }
        }
      } else {
        setError("Unable to create account right now. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#121212] text-[#fafafa] font-sans relative overflow-hidden">
      {/* Background Matrix & Subtle Faded Imagery */}
      {/* <div
        className="pointer-events-none absolute inset-0 z-0 opacity-10 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/stream-globe.jpg')" }}
      /> */}
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
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[320px] z-0 blur-[130px] opacity-15"
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

      {/* Main Register Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[460px]">
          {/* Card Shell with Hover Reveal & Glow */}
          <div className="group rounded-[18px] border border-[#2e2e2e] bg-[#171717]/95 backdrop-blur-md p-8 shadow-2xl transition-all duration-300 hover:border-[#ff6b35]/40 hover:shadow-[0_12px_40px_rgba(255,107,53,0.12)]">
            {/* Header */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 px-2.5 py-0.5 font-mono-code text-[11px] text-[#ff6b35] mb-2.5">
                <Zap className="h-3 w-3" />
                <span>Instant In-Memory Workspace</span>
              </div>
              <h1 className="text-2xl font-normal tracking-tight text-[#fafafa]">
                Create your workspace
              </h1>
              <p className="mt-1 text-sm text-[#898989] leading-relaxed">
                Start building high-speed DuckDB analytics, streaming Kafka pipelines, and governed canvases.
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
              {/* Full Name & Organization Name Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="register-name"
                    className="block text-xs font-medium text-[#b4b4b4] mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Elena Rostova"
                    disabled={isLoading}
                    suppressHydrationWarning
                    className={`w-full rounded-[10px] border px-3.5 py-2.5 text-sm font-normal text-[#fafafa] placeholder-[#898989] bg-[#121212] outline-none transition focus:border-[#ff6b35] disabled:opacity-50 ${
                      fieldErrors["name"]
                        ? "border-red-500/60 bg-red-950/20"
                        : "border-[#393939]"
                    }`}
                  />
                  <FieldError message={fieldErrors["name"]?.[0]} />
                </div>

                <div>
                  <label
                    htmlFor="register-org"
                    className="block text-xs font-medium text-[#b4b4b4] mb-1.5"
                  >
                    Organization
                  </label>
                  <input
                    id="register-org"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Acme Enterprise"
                    disabled={isLoading}
                    suppressHydrationWarning
                    className={`w-full rounded-[10px] border px-3.5 py-2.5 text-sm font-normal text-[#fafafa] placeholder-[#898989] bg-[#121212] outline-none transition focus:border-[#ff6b35] disabled:opacity-50 ${
                      fieldErrors["organizationName"]
                        ? "border-red-500/60 bg-red-950/20"
                        : "border-[#393939]"
                    }`}
                  />
                  <FieldError message={fieldErrors["organizationName"]?.[0]} />
                </div>
              </div>

              {/* Work Email */}
              <div>
                <label
                  htmlFor="register-email"
                  className="block text-xs font-medium text-[#b4b4b4] mb-1.5"
                >
                  Work Email
                </label>
                <input
                  id="register-email"
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

              {/* Password */}
              <div>
                <label
                  htmlFor="register-password"
                  className="block text-xs font-medium text-[#b4b4b4] mb-1.5"
                >
                  Password (min. 8 characters)
                </label>
                <input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
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

              {/* Features Included Pill */}
              <div className="rounded-[10px] border border-[#2e2e2e] bg-[#121212] p-3 text-[11px] font-mono-code text-[#898989]">
                <div className="text-[#fafafa] font-medium mb-1">
                  ✓ Isolated Multi-Tenant Tenant
                </div>
                <div>DuckDB Wasm SIMD-128 · Zero-Copy Arrow · SHA-256 Audit Trail</div>
              </div>

              {/* Submit Button */}
              <button
                id="register-submit"
                type="submit"
                disabled={isLoading}
                suppressHydrationWarning
                className="w-full mt-2 flex h-[42px] items-center justify-center gap-2 rounded-full border border-[#ff6b35]/80 bg-[#9a3412] px-4 text-sm font-medium text-[#fafafa] transition-colors hover:border-[#ff6b35] hover:bg-[#c2410c] disabled:opacity-60 cursor-pointer shadow-[0_0_20px_rgba(255,107,53,0.18)]"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2 text-xs">
                    <svg className="h-4 w-4 animate-spin text-[#fafafa]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Provisioning workspace…
                  </span>
                ) : (
                  <>
                    <span>Launch Free Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Terms note */}
            <p className="mt-4 text-center text-[11px] text-[#898989] leading-relaxed">
              By launching a workspace, you agree to the{" "}
              <Link href="/docs" className="text-[#b4b4b4] hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/docs" className="text-[#b4b4b4] hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-[#898989]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[#ff6b35] hover:text-[#ff8252] transition-colors"
            >
              Sign in to workspace →
            </Link>
          </p>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full py-4 text-center text-[11px] font-mono-code text-[#898989] border-t border-[#2e2e2e]/50">
        Enterprise In-Memory OLAP · Hardware HSM Enclave · End-to-End Encryption
      </footer>
    </div>
  );
}
