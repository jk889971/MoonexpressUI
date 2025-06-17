// next.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },

  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'charting_library': path.resolve(__dirname, 'public/charting_library'),
    };

    return config;
  },
};

export default nextConfig;