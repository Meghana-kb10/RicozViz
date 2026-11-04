import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { ToastProvider } from '@repo/components';
import { AdminAuthProvider } from '../context/AdminAuthContext';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RicozViz Admin — Platform Operations Console',
  description: 'Enterprise intelligence platform administration',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true
  }
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? undefined;

  return (
    <html lang="en" className="dark bg-[#0a0a0a] text-gray-100 antialiased">
      <body className="min-h-screen flex flex-col font-sans selection:bg-[#ff6b35]/20 selection:text-[#ff6b35]">
        <ToastProvider>
          <AdminAuthProvider>{children}</AdminAuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
