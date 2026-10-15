"use client";

import type { Metadata } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/auth-context";
import { ApiError } from "../../lib/api";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

// Note: metadata export can't be in a "use client" component.
// For SEO, this is handled at the layout level.

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsLoading(true);

    // Client-side validation
    const newErrors: Record<string, string[]> = {};
    if (!email) newErrors["email"] = ["Email is required"];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors["email"] = ["Please enter a valid email"];
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
    <div className="min-h-screen flex items-center justify-center bg-[#F4F1EA] dark:bg-[#111827] px-4 font-sans relative transition-colors duration-200">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* ---- Logo ---- */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo size={36} priority className="shadow-xs" />
            <span className="text-xl font-heading font-bold text-[#172B3A] dark:text-[#E5E7EB]">
              Ricoz<span className="text-[#147D78] dark:text-[#4F9D8E]">Viz</span>
            </span>
          </Link>
        </div>

        {/* ---- Card ---- */}
        <div className="rounded-xl border border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#1F2937] p-8 shadow-xs">
          <h1 className="text-2xl font-heading font-bold text-[#172B3A] dark:text-[#E5E7EB] mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-[#596775] dark:text-[#9CA3AF] mb-6">
            Sign in to your RicozViz workspace
          </p>

          {/* ---- Global error ---- */}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 px-4 py-3 text-sm text-red-700 dark:text-red-400"
            >
              {error}
            </div>
          )}

          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
            {/* ---- Email ---- */}
            <div className="mb-4">
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-[#172B3A] dark:text-[#E5E7EB] mb-1.5"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={isLoading}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-[#172B3A] dark:text-[#E5E7EB] placeholder-[#596775]/60 dark:placeholder-[#9CA3AF]/60 outline-none transition focus:ring-2 focus:ring-[#147D78] dark:focus:ring-[#4F9D8E] focus:border-[#147D78] dark:focus:border-[#4F9D8E] disabled:opacity-50 ${
                  fieldErrors["email"]
                    ? "border-red-400 bg-red-50 dark:bg-red-950/40"
                    : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#111827]"
                }`}
              />
              <FieldError message={fieldErrors["email"]?.[0]} />
            </div>

            {/* ---- Password ---- */}
            <div className="mb-6">
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-[#172B3A] dark:text-[#E5E7EB] mb-1.5"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-[#172B3A] dark:text-[#E5E7EB] placeholder-[#596775]/60 dark:placeholder-[#9CA3AF]/60 outline-none transition focus:ring-2 focus:ring-[#147D78] dark:focus:ring-[#4F9D8E] focus:border-[#147D78] dark:focus:border-[#4F9D8E] disabled:opacity-50 ${
                  fieldErrors["password"]
                    ? "border-red-400 bg-red-50 dark:bg-red-950/40"
                    : "border-[#DADFD9] dark:border-[#374151] bg-white dark:bg-[#111827]"
                }`}
              />
              <FieldError message={fieldErrors["password"]?.[0]} />
            </div>

            {/* ---- Submit ---- */}
            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[#147D78] hover:bg-[#106963] dark:bg-[#4F9D8E] dark:hover:bg-[#43887B] px-4 py-2.5 text-sm font-medium text-white shadow-xs transition focus:outline-none focus:ring-2 focus:ring-[#147D78] dark:focus:ring-[#4F9D8E] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* ---- Register link ---- */}
          <p className="mt-6 text-center text-sm text-[#596775] dark:text-[#9CA3AF]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-[#147D78] hover:text-[#106963] dark:text-[#4F9D8E] dark:hover:text-[#43887B]"
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
