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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#121212] px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
        <span className="text-2xl font-mono-code font-bold">!</span>
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="mb-2 max-w-md text-xs text-[#888888] leading-relaxed">
        An unexpected runtime exception was caught by the analytics safety boundary.
      </p>
      {error.digest && (
        <p className="mb-6 font-mono-code text-[11px] text-[#777777] bg-[#161616] border border-[#242424] px-3 py-1 rounded">
          Digest: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c2410c] transition cursor-pointer"
        >
          Try Again
        </button>
        <Link
          href="/dashboards"
          className="rounded-lg border border-[#2c2c2c] bg-[#1a1a1a] px-4 py-2 text-xs font-medium text-[#dedede] hover:bg-[#222222] hover:text-white transition cursor-pointer"
        >
          Dashboards
        </Link>
      </div>
    </div>
  );
}
