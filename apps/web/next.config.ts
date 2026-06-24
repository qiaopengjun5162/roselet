import type { NextConfig } from "next";

const isCloudflarePages = process.env.CF_PAGES === "true";

const nextConfig: NextConfig = {
  output: isCloudflarePages ? "export" : "standalone",
  distDir: isCloudflarePages ? "dist" : ".next",
  transpilePackages: ["@roselet/core"],
  turbopack: {},
};

export default nextConfig;
