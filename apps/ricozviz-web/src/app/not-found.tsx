import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-100">
        <span className="text-4xl">🔍</span>
      </div>
      <h1 className="mb-3 text-4xl font-bold text-gray-900">404</h1>
      <h2 className="mb-3 text-xl font-semibold text-gray-700">Page Not Found</h2>
      <p className="mb-8 max-w-md text-sm text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Check the URL and try again.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go Home
        </Link>
        <Link
          href="/workspace"
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Workspace
        </Link>
      </div>
    </div>
  );
}
