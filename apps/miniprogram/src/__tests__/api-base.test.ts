import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * 小程序的「后端地址」只有一处需要正确，但它错了没有任何测试会红：
 * 开发者工具里 localhost 是通的（工具和本地后端同机），真机上 localhost 是手机自己。
 * 2026-11-21 之前这里就是 `const BASE_URL = 'http://localhost:3001'`——
 * 工具里一切正常，真机上每个请求都失败。
 */

const loadRequestModule = () => {
  let mod: { API_BASE_URL: string } | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("@/utils/request") as { API_BASE_URL: string };
  });
  return mod as { API_BASE_URL: string };
};

const withEnv = <T>(env: Record<string, string | undefined>, fn: () => T): T => {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
};

describe("小程序的 API 基址", () => {
  it("生产构建指向真实 https 入口，绝不是 localhost", () => {
    const mod = withEnv({ NODE_ENV: "production", TARO_APP_API_BASE: undefined }, loadRequestModule);
    expect(mod.API_BASE_URL).toMatch(/^https:\/\//);
    expect(mod.API_BASE_URL).not.toContain("localhost");
  });

  it("可以用 TARO_APP_API_BASE 覆盖（换正式域名时唯一要改的地方）", () => {
    const mod = withEnv(
      { NODE_ENV: "production", TARO_APP_API_BASE: "https://roselet.ccwu.cc" },
      loadRequestModule,
    );
    expect(mod.API_BASE_URL).toBe("https://roselet.ccwu.cc");
  });

  it("开发时退回本机后端，方便在开发者工具里联调", () => {
    const mod = withEnv({ NODE_ENV: "development", TARO_APP_API_BASE: undefined }, loadRequestModule);
    expect(mod.API_BASE_URL).toBe("http://localhost:3001");
  });

  it("构建配置真的把这个环境变量替换进去", () => {
    // 只改 request.ts 不够：真机上没有 process.env，构建期不替换就永远读不到。
    const config = readFileSync(resolve(__dirname, "../../config/index.ts"), "utf8");
    expect(config).toContain("process.env.TARO_APP_API_BASE");
    expect(config).toMatch(/JSON\.stringify\(process\.env\.TARO_APP_API_BASE/);
  });

  it("CI 会真去翻打出来的包，而不只是编译通过", () => {
    // 2026-11-21：CI 里只有 `pnpm build:weapp`，构建成功不代表包里地址是对的。
    // 地址是构建期替换的字面量，构建参数漏了源码看着也没问题。
    const root = resolve(__dirname, "../../../..");
    const script = readFileSync(resolve(root, "scripts/verify-miniprogram-build.mjs"), "utf8");
    expect(script).toContain("localhost:3001");
    expect(script).toContain("process.exit(1)");

    const workflow = readFileSync(resolve(root, ".github/workflows/build.yml"), "utf8");
    expect(workflow).toContain("scripts/verify-miniprogram-build.mjs");
    // 顺序上必须在构建之后，否则查的是一个还不存在的目录。
    const buildAt = workflow.indexOf("Build miniprogram");
    const checkAt = workflow.indexOf("verify-miniprogram-build.mjs");
    expect(checkAt).toBeGreaterThan(buildAt);
  });
});
