import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  // No need for serverExternalPackages anymore - we're proxying to a separate API server
};

export default nextConfig;
