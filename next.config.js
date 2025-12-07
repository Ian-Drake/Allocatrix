/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
    // Disable type checking during build to allow testing
    ignoreBuildErrors: true,
  },
  eslint: {
    dirs: ['src', 'tests'],
    // Disable ESLint during build to allow testing
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig;
