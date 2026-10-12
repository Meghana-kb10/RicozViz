/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@repo/components',
    '@repo/utils',
    '@repo/types',
    '@repo/api',
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
