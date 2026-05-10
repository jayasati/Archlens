/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@archlens/shared-types', '@archlens/ir-schema'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
