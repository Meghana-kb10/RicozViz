import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/auth-context";
import { WorkspaceProvider } from "../contexts/workspace-context";
import { ScrollProgressBar } from "../components/shell/ScrollProgressBar";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});
export const metadata: Metadata = {
  title: {
    default: "RicozViz — Enterprise Intelligence & Governed Analytics",
    template: "%s | RicozViz",
  },
  description:
    "RicozViz: Award-winning data visualization workspace, real-time collaboration, embedded analytics, and governed business intelligence.",
  keywords: ["data visualization", "dashboards", "analytics", "business intelligence", "realtime analytics"],
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="antialiased min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] selection:bg-indigo-600 selection:text-white">
        <ScrollProgressBar />
        <AuthProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
