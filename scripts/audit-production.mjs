#!/usr/bin/env node
/**
 * CI 门禁：`pnpm audit --prod --json | node scripts/audit-production.mjs`
 *
 * 它守的是一条很具体的线：**用户能从公网打到、部署在生产服务器上的 Web 包，
 * 不能带 critical（可远程利用）漏洞**。这是 2026-11-24 那次安全升级定下的
 * 边界——Next.js 的 4 个 critical RCE 是当时唯一的真实暴露面，已升到 16.4.6
 * 清掉。这个门禁防止它悄悄回潮（比如有人为了兼容性把 next 降回去）。
 *
 * 为什么不用 `pnpm audit --audit-level critical` 直接了事：
 *   pnpm 9 的 `--prod` 在这个 monorepo 里仍把小程序的 Taro 工具链算进来（Taro
 *   把 webpack-dev-server / swiper / shell-quote 声明成 dependencies 而非 dev），
 *   它们跑在微信客户端沙箱、不部署到我们的服务器，不是这个项目的暴露面。
 *   一刀切会让 CI 长期飘红——而长期飘红的门禁等于没有门禁。
 *
 * 判定（只按工作区包 + 严重级别，不猜 tree-shaking）：
 *   - blocking：apps/web 里的 critical。这是公网可达 + 可远程利用的交集。
 *   - exempt：命中 EVALUATED_EXEMPTIONS 的项——逐条评估过、确认在当前用法下
 *       不可利用或无法安全升级，带理由打印出来。豁免按 advisory ID + 模块精确
 *       匹配，且永远让位于 blocking（安全优先）。见下方清单。
 *   - observed：剩下的 critical 和 high，作为「待评估观察项」打印，不阻断。
 *       其中 apps/miniprogram 的整条链特别标注为「小程序构建工具链」。
 *   - moderate/low/info：完全忽略（量大且多是构建期噪音）。
 *
 * 边界要诚实：这个门禁不声称覆盖 agent-api / worker-api 的 high（undici、
 * MCP SDK、hono 等）——那些是需要单独评估、部分暂无修复版的另一类工作，
 * 混进来只会让门禁失效。它只守住已经确认为真实暴露面的那一条线。
 *
 * 豁免清单不是静默放过：每条都带理由和复审日期，且只认 advisory ID + 模块。
 * 同一模块将来出新的 advisory（新 ID）不会被豁免，web critical 也永远优先阻断。
 *
 * 输出纪律：仓库是 public，这些行会进 Actions 日志。只打印模块名、级别、
 * advisory ID 和依赖路径，不打印任何业务数据。
 */

const WEB = "apps/web";
const MINIPROGRAM = "apps/miniprogram";

/**
 * 已逐条评估、确认「当前用法下不可利用 / 无法安全升级」的漏洞。
 *
 * 只按 advisory ID + 模块名精确匹配——同模块出新 advisory（新 ID）不会被豁免。
 * 每条理由必须写清「为什么现在安全」和「什么条件下要重新评估」，否则就是
 * 静默放过，违背这个项目公开日志可审计的纪律。
 */
const EVALUATED_EXEMPTIONS = {
  "GHSA-mrhx-c7xc-m3w5": {
    module: "zod",
    reason:
      "DoS 只在校验 oversized constrained collections 时可触发；agent-api 唯一" +
      "用法是 MCP tool schema 的 z.enum + z.string().max(500)，无无上限集合，" +
      "且走 stdio 本地传输、非公网。修复需跨 4.x 大版本，但 zod 被 MCP SDK / " +
      "x402 / viem / abitype / zod-to-json-schema 等传递依赖，后者只支持 zod 3，" +
      "全局 override 会破坏它们——升级风险大于收益。",
    recheckWhen: "agent-api 或 web 出现 z.array/z.record 等集合校验并接受外部输入，或 stdio 改公网传输时",
  },
};

/** 一条 finding path 形如 "apps/web > next@16.2.6"，取第一段作为工作区包名。 */
function workspaceOf(path) {
  return typeof path === "string" ? path.split(" > ")[0] : "";
}

/**
 * 纯函数：把 pnpm audit 的 advisories 分成「必须修」和「观察项」。
 * @param {object} audit  pnpm audit --prod --json 的输出
 * @returns {{ blocking: Array, exempt: Array, observed: Array, counts: object }}
 */
export function evaluate(audit) {
  const blocking = [];
  const exempt = [];
  const observed = [];
  const advisories = Object.values(audit?.advisories || {});

  for (const a of advisories) {
    const severity = a.severity;
    if (severity !== "critical" && severity !== "high") continue;

    const paths = (a.findings || []).flatMap((f) => f.paths || []);
    const inWeb = paths.some((p) => workspaceOf(p) === WEB);
    const inMini = paths.every((p) => workspaceOf(p) === MINIPROGRAM);
    const id = a.github_advisory_id || a.npm_advisory_id || String(a.id || "");
    const item = {
      module: a.module_name,
      severity,
      id,
      title: a.title,
      paths,
      scope: inMini ? "miniprogram-build" : inWeb ? "web" : "other",
    };

    // 唯一会阻断的情形：web 包里的 critical（公网可达 × 可远程利用）。
    // 豁免永远让位于它——即使 ID 命中豁免清单，web critical 也必须修。
    if (inWeb && severity === "critical") {
      blocking.push(item);
      continue;
    }
    // 已评估豁免：advisory ID + 模块名精确匹配。
    const waiver = EVALUATED_EXEMPTIONS[id];
    if (waiver && waiver.module === a.module_name) {
      exempt.push({ ...item, reason: waiver.reason, recheckWhen: waiver.recheckWhen });
      continue;
    }
    observed.push(item);
  }

  const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
  for (const a of advisories) {
    if (a.severity in counts) counts[a.severity] += 1;
  }
  return { blocking, exempt, observed, counts };
}

/** 把结果渲染成人类可读、且能进 public CI 日志的行。 */
export function format(result) {
  const lines = [];
  const { counts } = result;
  lines.push(
    `audit: critical=${counts.critical} high=${counts.high} ` +
    `moderate=${counts.moderate} low=${counts.low}`,
  );

  if (result.exempt?.length) {
    lines.push(`已评估豁免 ${result.exempt.length} 条（逐条确认当前用法不可利用 / 无法安全升级）：`);
    for (const e of result.exempt) {
      lines.push(`  · [${e.severity}] ${e.module} ${e.id} — ${e.title}`);
      lines.push(`      理由：${e.reason}`);
      lines.push(`      复审：${e.recheckWhen}`);
    }
  }

  const mini = result.observed.filter((o) => o.scope === "miniprogram-build");
  const other = result.observed.filter((o) => o.scope !== "miniprogram-build");
  if (mini.length) {
    lines.push(`观察 ${mini.length} 条（小程序构建工具链，跑在微信沙箱、不部署到生产服务器）：`);
    const shown = mini.slice(0, 5);
    for (const e of shown) lines.push(`  · [${e.severity}] ${e.module} ${e.id} — ${e.title}`);
    if (mini.length > shown.length) lines.push(`  · ...另有 ${mini.length - shown.length} 条同类`);
  }
  if (other.length) {
    lines.push(`观察 ${other.length} 条（high 或 agent-api/worker-api 项，单独评估、暂不阻断）：`);
    const shown = other.slice(0, 5);
    for (const e of shown) lines.push(`  · [${e.severity}] ${e.module} ${e.id} — ${e.title}`);
    if (other.length > shown.length) lines.push(`  · ...另有 ${other.length - shown.length} 条同类`);
  }
  if (result.blocking.length) {
    lines.push(`生产 Web 暴露面 ${result.blocking.length} 条，必须修复：`);
    for (const b of result.blocking) {
      lines.push(`  ✗ [${b.severity}] ${b.module} ${b.id} — ${b.title}`);
      for (const p of b.paths.slice(0, 3)) lines.push(`      ${p}`);
    }
  } else {
    lines.push("OK 生产 Web 包无 critical 漏洞。");
  }
  return lines.join("\n");
}

export async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    console.error("没有读到 audit JSON（用法：pnpm audit --prod --json | node scripts/audit-production.mjs）");
    return 2;
  }
  let audit;
  try {
    audit = JSON.parse(raw);
  } catch {
    console.error("audit 输出不是合法 JSON");
    return 2;
  }
  const result = evaluate(audit);
  console.log(format(result));
  return result.blocking.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error("audit-production 异常:", e);
    process.exit(2);
  });
}
