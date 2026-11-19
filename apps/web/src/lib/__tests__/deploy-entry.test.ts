import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * 这条守卫管的是「国内的试用者能不能打开」这件事本身。
 *
 * 2026-11-19：`*.vercel.app` 在国内被 DNS 污染（三个公共 DNS 返回三个不同的境外 IP），
 * Vercel 的边缘 IP 直连也会在 TLS 握手阶段失败；`sslip.io` 的权威 DNS 在国内不可达。
 * 唯一通的地址是服务器裸 IP，所以页面必须自己也发一份到那台机器上，和 API 同源。
 *
 * 一旦有人把 Caddy 的 `:80` 改回「全给后端」、或把 compose 里的 web 服务删掉、
 * 或忘记把 API 基址编进镜像，5 人试用就又变成「打不开」——
 * 而这几种改动都不会让任何单元测试变红，所以在这里显式守住。
 */

const ROOT = resolve(__dirname, "../../../../..");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

const CADDY = "deploy/lightsail/Caddyfile";
const COMPOSE = "deploy/lightsail/docker-compose.backend.yml";
const WORKFLOW = ".github/workflows/deploy-backend.yml";
const DOCKERFILE = "Dockerfile.web";

/** 从 `start` 的成对花括号处整块取出，snippet 里还会有嵌套块，不能用第一个 `}` 截断。 */
const blockFrom = (source: string, start: number) => {
  const open = source.indexOf("{", start);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return "";
};

const namedBlock = (source: string, name: string) => {
  const at = source.indexOf(`(${name})`);
  return at === -1 ? "" : blockFrom(source, at);
};

const siteBlock = (source: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 站点名必须独占一行开头，否则注释里顺口提一句 ":80" 就会把断言引到别处。
  const at = new RegExp(`^${escaped}\\s*\\{`, "m").exec(source);
  return at ? blockFrom(source, at.index) : "";
};

describe("国内可用的试用入口", () => {
  it("Caddy 的 80 端口把 /api 给后端、其余给前端", () => {
    const caddy = read(CADDY);

    // 端口总是这样配的，真正指到哪由 snippet 决定，所以要顺着 import 一起看。
    expect(namedBlock(caddy, "roselet_backend")).toContain("127.0.0.1:3001");
    expect(namedBlock(caddy, "roselet_web")).toContain("127.0.0.1:3000");

    const port80 = siteBlock(caddy, ":80");
    expect(port80).toContain("import roselet_routes");

    // 默认 handle 必须是前端，否则打开的还是一个只有 API 的地址。
    const routes = namedBlock(caddy, "roselet_routes");
    expect(routes).toMatch(/handle\s*\/api\/\*[\s\S]*roselet_backend/);
    expect(routes).toMatch(/handle\s*\{[\s\S]*roselet_web/);
  });

  it("80 端口的响应是压缩过的，否则一条烂链路能把首屏拖到十几秒", () => {
    // 2026-11-19：前端搬到新加坡机器后，Caddy 没开压缩，
    // 105KB 的 CSS 在国内直连下要 7~23 秒才下完（同一条链路上 SYN 丢包 20%~30%，
    // 字节越多，被丢包卡住的次数越多），页面看起来就是「打不开」。
    // 压缩后同样的文件 16.5KB，首屏回到 1 秒级。
    const port80 = siteBlock(read(CADDY), ":80");
    expect(port80).toMatch(/encode\s+[^\n]*gzip/);
  });

  it("compose 里有前端服务，镜像来自 WEB_IMAGE", () => {
    const compose = read(COMPOSE);
    expect(compose).toMatch(/^\s{2}web:/m);
    expect(compose).toContain("WEB_IMAGE");
  });

  it("compose 里来自环境变量的镜像名都有兜底值", () => {
    // 2026-11-19：只改前端时 BACKEND_IMAGE 是空的，而 `docker compose pull web`
    // 会先校验整个 project，于是报 "service backend has neither an image nor a
    // build context specified"，发布在碰前端之前就退出了——线上停在旧版本，
    // 流水线红着，但页面本身还能开，所以很容易被当成「又改坏了」。
    const compose = read(COMPOSE);
    const fromEnv = compose
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("image:") && line.includes("${"));

    expect(fromEnv.length).toBeGreaterThan(0);
    for (const line of fromEnv) {
      expect(line).toMatch(/\$\{[A-Z_]+:-[^}]+\}/);
    }
  });

  it("部署流水线会把 API 基址编进前端镜像", () => {
    const workflow = read(WORKFLOW);
    expect(workflow).toContain("Dockerfile.web");
    expect(workflow).toMatch(/NEXT_PUBLIC_API_URL=http:\/\/\$\{\{\s*secrets\.LIGHTSAIL_HOST\s*\}\}/);
  });

  it("前端镜像带上了 static 与 public，否则页面能开、资源 404", () => {
    const dockerfile = read(DOCKERFILE);
    expect(dockerfile).toContain(".next/standalone");
    expect(dockerfile).toContain(".next/static");
    expect(dockerfile).toContain("apps/web/public");
  });

  it("源码里不能把打不开的域名当兜底", () => {
    // 上链后的 NFT uri 改不了，分享出去的链接也一样。
    // 先去掉注释：注释里必须能写清「为什么不要这么做」，那不算兜底。
    const code = read("apps/web/src/lib/solana.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toContain("vercel.app");
    expect(code).not.toContain("sslip.io");
  });
});
