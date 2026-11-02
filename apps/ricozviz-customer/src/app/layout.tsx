import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/auth-context";
import { WorkspaceProvider } from "../contexts/workspace-context";
import { ThemeProvider } from "../contexts/theme-context";
import { ScrollProgressBar } from "../components/shell/ScrollProgressBar";

const fontHeading = Inter({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["500", "600", "700"],
});

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontHeading.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('ricozviz-theme');
                  var isDark = stored !== 'light';
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="antialiased min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] selection:bg-[#ff6b35] selection:text-white font-sans"
      >
        <ScrollProgressBar />
        <ThemeProvider defaultTheme="dark">
          <AuthProvider>
            <WorkspaceProvider>{children}</WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
