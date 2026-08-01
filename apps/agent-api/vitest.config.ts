import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "v8",
      exclude: [
        "pkg/**",
        "dist/**",
        "src/client.ts",
        "src/mcp.ts",
        "src/server.ts",
        "vitest.config.ts",
        "**/*.test.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
