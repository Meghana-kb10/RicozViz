/** @type {import('next').NextConfig} */
const adminProxyOrigin = (
  process.env.ADMIN_API_ORIGIN ||
  process.env.BACKEND_API_URL ||
  ''
)
  .trim()
  .replace(/\/+$/, '');

const nextConfig = {
  output: 'standalone',
  // Automatically route admin browser calls same-origin when ADMIN_API_ORIGIN is configured without a public API URL (e.g. Vercel -> Render)
  ...(adminProxyOrigin && !process.env.NEXT_PUBLIC_ADMIN_API_URL && !process.env.NEXT_PUBLIC_API_URL
    ? { env: { NEXT_PUBLIC_ADMIN_API_URL: 'same-origin' } }
    : {}),
  // Workspace packages ship raw TypeScript sources, so Next must transpile them.
  transpilePackages: [
    '@repo/api',
    '@repo/components',
    '@repo/types',
    '@repo/utils',
    '@repo/validation'
  ],
  async rewrites() {
    if (!adminProxyOrigin) return [];
    return [
      {
        source: '/admin/:path*',
        destination: `${adminProxyOrigin}/admin/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=(), payment=(), usb=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' }
        ]
      }
    ];
  },
  webpack(config) {
    // Shared packages use Node ESM `.js` specifiers for their TypeScript sources.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js']
    };
    return config;
  }
};

export default nextConfig;
