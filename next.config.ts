import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.meshy.ai',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
