"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-100">
        <span className="text-4xl">⚠️</span>
      </div>
      <h1 className="mb-3 text-2xl font-bold text-gray-900">Something went wrong</h1>
      <p className="mb-2 max-w-md text-sm text-gray-500">
        An unexpected error occurred. The error has been logged automatically.
      </p>
      {error.digest && (
        <p className="mb-6 font-mono text-xs text-gray-400">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
