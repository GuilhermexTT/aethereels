import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@remotion/lambda",
    "@remotion/renderer",
    "@remotion/bundler",
    "esbuild"
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' blob:; connect-src *; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline';",
          },
        ],
      },
    ];
  }
};

export default nextConfig;
