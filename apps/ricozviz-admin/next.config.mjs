/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript sources, so Next must transpile them.
  transpilePackages: [
    '@repo/api',
    '@repo/components',
    '@repo/types',
    '@repo/utils',
    '@repo/validation'
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' http://localhost:4000 http://localhost:3002 ws: wss:; frame-ancestors 'none'; object-src 'none'; base-uri 'self';"
          },
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
