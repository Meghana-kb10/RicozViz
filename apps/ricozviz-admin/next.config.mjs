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
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:4000 http://localhost:3002; frame-ancestors 'none';"
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
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
