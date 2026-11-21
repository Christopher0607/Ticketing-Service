import type { NextConfig } from "next";

const config: NextConfig = {
  output: process.env.SETLIST_DOCKER_BUILD === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  devIndicators: false,
  agentRules: false,
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};
export default config;
