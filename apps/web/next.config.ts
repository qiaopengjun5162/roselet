import type { NextConfig } from "next";

const isCloudflarePages = process.env.CF_PAGES === "true";

const nextConfig: NextConfig = {
  output: isCloudflarePages ? "export" : "standalone",
  distDir: isCloudflarePages ? "dist" : ".next",
  transpilePackages: ["@roselet/core"],
  turbopack: {},
  // The in-build TypeScript worker can hang inside restricted CI/sandbox
  // environments. The Solana E2E harness opts out with E2E_SKIP_TYPECHECK=1;
  // normal builds still run the full typecheck (and `pnpm typecheck` remains
  // the authoritative gate).
  ...(process.env.E2E_SKIP_TYPECHECK === "1"
    ? { typescript: { ignoreBuildErrors: true } }
    : {}),
};

export default nextConfig;
