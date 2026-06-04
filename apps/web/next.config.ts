import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@roselet/core"],
  turbopack: {},
};

export default nextConfig;
