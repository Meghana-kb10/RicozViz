/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript sources, so Next must transpile them.
  transpilePackages: [
    '@repo/api',
    '@repo/types',
    '@repo/utils',
    '@repo/validation'
  ],
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