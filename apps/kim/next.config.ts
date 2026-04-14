import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  transpilePackages: ["@1tt/api-client"],
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
