import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "condiment-schnapps-paramedic.ngrok-free.dev"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",
      },
      {
        source: "/storage/:path*",
        destination: "http://localhost:8000/storage/:path*",
      },
      {
        source: "/auth/:path*",
        destination: "http://localhost:8000/auth/:path*",
      },
      {
        source: "/jobs/:path*",
        destination: "http://localhost:8000/jobs/:path*",
      },
      {
        source: "/clips/:path*",
        destination: "http://localhost:8000/clips/:path*",
      },
      {
        source: "/health",
        destination: "http://localhost:8000/health",
      },
    ];
  },
};

export default nextConfig;
