import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@roselet/core"],
  turbopack: {},
};

export default nextConfig;
