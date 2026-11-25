/** @type {import('next').NextConfig} */
const backendProxyOrigin = (
  process.env.BACKEND_API_URL ||
  process.env.API_PROXY_TARGET ||
  ''
)
  .trim()
  .replace(/\/+$/, '');

const nextConfig = {
  output: 'standalone',
  // Automatically route browser REST + refresh cookie calls same-origin when BACKEND_API_URL proxy is configured (e.g. Vercel -> Render)
  ...(backendProxyOrigin && !process.env.NEXT_PUBLIC_API_URL
    ? { env: { NEXT_PUBLIC_API_URL: 'same-origin' } }
    : {}),
  // Workspace packages ship raw TypeScript sources, so Next must transpile them.
  transpilePackages: [
    '@repo/api',
    '@repo/types',
    '@repo/utils',
    '@repo/validation'
  ],
  async rewrites() {
    if (!backendProxyOrigin) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendProxyOrigin}/api/v1/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboards',
        permanent: true,
      },
      {
        source: '/dashboard/:path*',
        destination: '/dashboards/:path*',
        permanent: true,
      },
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
