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

describe("国内可用的试用入口", () => {
  it("Caddy 的 80 端口把 /api 给后端、其余给前端", () => {
    const caddy = read(CADDY);

    // 端口总是这样配的，真正指到哪由两个 snippet 决定，所以要一起看。
    const snippet = (name: string) => {
      const start = caddy.indexOf(`(${name})`);
      expect(start).toBeGreaterThan(-1);
      const end = caddy.indexOf("}", caddy.indexOf("reverse_proxy", start));
      return caddy.slice(start, end + 1);
    };
    expect(snippet("roselet_backend")).toContain("127.0.0.1:3001");
    expect(snippet("roselet_web")).toContain("127.0.0.1:3000");

    const port80 = caddy.slice(caddy.indexOf(":80"));
    expect(port80).toContain("handle /api/*");
    expect(port80).toMatch(/handle\s*\/api\/\*[\s\S]*roselet_backend/);
    // 默认 handle 必须是前端，否则打开的还是一个只有 API 的地址。
    expect(port80).toMatch(/handle\s*\{[\s\S]*roselet_web/);
  });

  it("compose 里有前端服务，镜像来自 WEB_IMAGE", () => {
    const compose = read(COMPOSE);
    expect(compose).toMatch(/^\s{2}web:/m);
    expect(compose).toContain("WEB_IMAGE");
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
});
