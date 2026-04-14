import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import withBundleAnalyzer from "@next/bundle-analyzer";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  transpilePackages: ["@1tt/api-client"],
  experimental: {
    optimizeCss: true,
  },
};

const config =
  process.env.ANALYZE === "true"
    ? withBundleAnalyzer({ enabled: true })(nextConfig)
    : nextConfig;

export default config;
