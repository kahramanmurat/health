import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/health',
        destination: 'http://127.0.0.1:3001/health',
      },
    ];
  },
};

export default nextConfig;
