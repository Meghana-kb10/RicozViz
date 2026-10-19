import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#121212] px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff6b35]/15 border border-[#ff6b35]/30 text-[#ff6b35]">
        <span className="text-2xl font-mono-code font-bold">404</span>
      </div>
      <h1 className="mb-2 text-2xl font-semibold text-white">Page Not Found</h1>
      <p className="mb-8 max-w-md text-xs text-[#888888] leading-relaxed">
        The canvas or analytics path you&apos;re looking for doesn&apos;t exist or has been relocated.
      </p>
      <div className="flex gap-3">
        <Link
          href="/dashboards"
          className="rounded-lg bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c2410c] transition cursor-pointer"
        >
          View Dashboards
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-[#2c2c2c] bg-[#1a1a1a] px-4 py-2 text-xs font-medium text-[#dedede] hover:bg-[#222222] hover:text-white transition cursor-pointer"
        >
          Overview
        </Link>
      </div>
    </div>
  );
}
