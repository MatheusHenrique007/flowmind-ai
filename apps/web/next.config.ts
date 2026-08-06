import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pins the workspace root to this monorepo — avoids Next.js inferring an unrelated
  // ancestor directory when a stray lockfile exists further up the filesystem tree.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
};

export default nextConfig;
