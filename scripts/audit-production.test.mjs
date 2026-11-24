import assert from "node:assert/strict";
import test from "node:test";

import { evaluate, format } from "./audit-production.mjs";

/** 构造一条 pnpm audit advisory 的最小形状。 */
function advisory(severity, module, id, paths) {
  return {
    severity,
    module_name: module,
    github_advisory_id: id,
    title: `${module} test advisory`,
    findings: [{ paths }],
  };
}

const WEB = "apps/web > next@16.2.6";
const WEB_DEEP = "apps/web > shadcn@4.8.0 > ts-morph@26.0.0 > brace-expansion@5.0.6";
const API = "apps/agent-api > undici@7.28.0";
const WORKER = "apps/worker-api > hono@4.12.23";
const MINI = "apps/miniprogram > @tarojs/taro@4.2.0 > webpack-dev-server@4.15.2 > shell-quote@1.8.4";

test("web 包里的 critical 必须阻断（这是要守住的核心线）", () => {
  const r = evaluate({ advisories: { 1: advisory("critical", "next", "GHSA-X", [WEB]) } });
  assert.equal(r.blocking.length, 1);
  assert.equal(r.blocking[0].module, "next");
  assert.equal(r.blocking[0].scope, "web");
  assert.equal(r.observed.length, 0);
});

test("web 里的 high 不阻断，只记为观察项", () => {
  const r = evaluate({ advisories: { 1: advisory("high", "js-yaml", "GHSA-Y", [WEB_DEEP]) } });
  assert.equal(r.blocking.length, 0);
  assert.equal(r.observed.length, 1);
  assert.equal(r.observed[0].scope, "web");
});

test("agent-api / worker-api 的 high 只观察，不阻断", () => {
  const r = evaluate({
    advisories: {
      1: advisory("high", "undici", "GHSA-U", [API]),
      2: advisory("high", "hono", "GHSA-H", [WORKER]),
    },
  });
  assert.equal(r.blocking.length, 0);
  assert.equal(r.observed.length, 2);
  assert.ok(r.observed.every((o) => o.scope === "other"));
});

test("小程序构建工具链的 critical 豁免，标为 miniprogram-build 且打印出来", () => {
  const r = evaluate({ advisories: { 1: advisory("critical", "shell-quote", "GHSA-Z", [MINI]) } });
  assert.equal(r.blocking.length, 0);
  assert.equal(r.observed.length, 1);
  assert.equal(r.observed[0].scope, "miniprogram-build");
  assert.match(format(r), /小程序构建工具链/);
  assert.match(format(r), /shell-quote/);
});

test("一条 advisory 同时命中 web 和小程序：web 的 critical 仍阻断", () => {
  const r = evaluate({
    advisories: { 1: advisory("critical", "swiper", "GHSA-S", [MINI, WEB]) },
  });
  assert.equal(r.blocking.length, 1);
  assert.equal(r.observed.length, 0);
});

test("web 的 critical + 小程序的 critical 混合：一个阻断一个观察", () => {
  const r = evaluate({
    advisories: {
      1: advisory("critical", "next", "GHSA-X", [WEB]),
      2: advisory("critical", "shell-quote", "GHSA-Z", [MINI]),
    },
  });
  assert.equal(r.blocking.length, 1);
  assert.equal(r.observed.length, 1);
  assert.equal(r.observed[0].scope, "miniprogram-build");
});

test("moderate / low 完全忽略，但仍计入 counts", () => {
  const r = evaluate({
    advisories: {
      1: advisory("moderate", "next", "GHSA-M", [WEB]),
      2: advisory("low", "next", "GHSA-L", [WEB]),
    },
  });
  assert.equal(r.blocking.length, 0);
  assert.equal(r.observed.length, 0);
  assert.equal(r.counts.moderate, 1);
  assert.equal(r.counts.low, 1);
});

test("空 / 畸形输入不当场崩溃", () => {
  assert.deepEqual(evaluate(null).blocking, []);
  assert.deepEqual(evaluate({}).blocking, []);
});

test("format 同时呈现计数、暴露面和观察项", () => {
  const r = evaluate({
    advisories: {
      1: advisory("critical", "next", "GHSA-X", [WEB]),
      2: advisory("critical", "shell-quote", "GHSA-Z", [MINI]),
    },
  });
  const out = format(r);
  assert.match(out, /critical=2/);
  assert.match(out, /生产 Web 暴露面 1 条/);
  assert.match(out, /apps\/web > next/);
  assert.match(out, /小程序构建工具链/);
});
