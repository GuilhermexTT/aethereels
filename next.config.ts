import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@remotion/lambda",
    "@remotion/renderer",
    "@remotion/bundler",
    "esbuild"
  ]
};

export default nextConfig;
