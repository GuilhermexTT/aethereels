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
            value: "default-src 'self' https: http: localhost:* http://localhost:*; script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http: localhost:* http://localhost:*; style-src 'self' 'unsafe-inline' https: http: fonts.googleapis.com; img-src 'self' data: blob: https: http:; media-src 'self' data: blob: https: http:; connect-src 'self' https: wss: http:; font-src 'self' data: https: http: fonts.gstatic.com; frame-src 'self' https: http:;",
          },
        ],
      },
    ];
  }
};

export default nextConfig;
