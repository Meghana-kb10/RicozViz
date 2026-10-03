"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/auth-context";
import { ApiError } from "../../lib/api";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
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
    if (!name.trim()) newErrors["name"] = ["Full name is required"];
    if (!email) newErrors["email"] = ["Email is required"];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors["email"] = ["Please enter a valid email"];
    if (!password) newErrors["password"] = ["Password is required"];
    else if (password.length < 8)
      newErrors["password"] = ["Password must be at least 8 characters"];
    if (!organizationName.trim())
      newErrors["organizationName"] = ["Organization name is required"];

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      await register({ name, email, password, organizationName });
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* ---- Logo ---- */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
              <span className="text-base font-bold text-white">R</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">RicozViz</span>
          </Link>
        </div>

        {/* ---- Card ---- */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 mb-6">
            Start building your analytics workspace
          </p>

          {/* ---- Global error ---- */}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
            {/* ---- Full name ---- */}
            <div className="mb-4">
              <label
                htmlFor="register-name"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Full name
              </label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                disabled={isLoading}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 disabled:opacity-50 ${
                  fieldErrors["name"]
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
              />
              <FieldError message={fieldErrors["name"]?.[0]} />
            </div>

            {/* ---- Organization name ---- */}
            <div className="mb-4">
              <label
                htmlFor="register-org"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Organization name
              </label>
              <input
                id="register-org"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Corp"
                disabled={isLoading}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 disabled:opacity-50 ${
                  fieldErrors["organizationName"]
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
              />
              <FieldError message={fieldErrors["organizationName"]?.[0]} />
            </div>

            {/* ---- Email ---- */}
            <div className="mb-4">
              <label
                htmlFor="register-email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Work email
              </label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={isLoading}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 disabled:opacity-50 ${
                  fieldErrors["email"]
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
              />
              <FieldError message={fieldErrors["email"]?.[0]} />
            </div>

            {/* ---- Password ---- */}
            <div className="mb-6">
              <label
                htmlFor="register-password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                disabled={isLoading}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 disabled:opacity-50 ${
                  fieldErrors["password"]
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300 bg-white"
                }`}
              />
              <FieldError message={fieldErrors["password"]?.[0]} />
            </div>

            {/* ---- Submit ---- */}
            <button
              id="register-submit"
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  Creating account…
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* ---- Login link ---- */}
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
