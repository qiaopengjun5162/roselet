import fs from "node:fs";
import path from "node:path";

describe("Cloudflare Pages routes", () => {
  it("limits function invocations to rose detail fallback routes", () => {
    const routesPath = path.join(process.cwd(), "public", "_routes.json");

    expect(fs.existsSync(routesPath)).toBe(true);

    const routes = JSON.parse(fs.readFileSync(routesPath, "utf8")) as {
      version: number;
      include: string[];
      exclude: string[];
    };

    expect(routes).toEqual({
      version: 1,
      include: ["/rose/*"],
      exclude: [],
    });
  });
});
