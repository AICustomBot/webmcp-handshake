import type { NextConfig } from 'next';

const CLOUDFLARE_WORKER_URL =
  process.env.CLOUDFLARE_WORKER_URL ||
  process.env.NEXT_PUBLIC_CLOUDFLARE_WORKER_URL ||
  'https://webmcp-handshake.workers.dev';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  transpilePackages: ['@handshake/contracts', '@handshake/policy'],
  turbopack: {},
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${CLOUDFLARE_WORKER_URL}/api/v1/:path*`,
      },
      {
        source: '/healthz',
        destination: `${CLOUDFLARE_WORKER_URL}/healthz`,
      },
    ];
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      type: 'asset/resource',
    });
    return config;
  },
};

export default nextConfig;
