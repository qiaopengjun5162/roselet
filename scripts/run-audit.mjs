#!/usr/bin/env node
/**
 * 包一层 `pnpm audit --prod --json`，解决它的退出码语义：
 * pnpm audit 发现任何漏洞都 exit 1，但我们的门禁判定不是「有漏洞就红」，
 * 而是「web 包有 critical 才红」（见 audit-production.mjs）。
 * 所以这里把 audit 的 JSON 落临时文件、吞掉它的退出码，再交给判定脚本，
 * 由判定脚本的退出码作为整个门禁的结果。
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "roselet-audit-"));
const file = join(dir, "audit.json");
try {
  const audit = spawnSync("pnpm", ["audit", "--prod", "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!audit.stdout || !audit.stdout.trim()) {
    console.error("pnpm audit 没有产出 JSON：", audit.stderr?.trim() || "无输出");
    process.exit(2);
  }
  writeFileSync(file, audit.stdout);
  const json = readFileSync(file, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    console.error("pnpm audit 的输出不是合法 JSON");
    process.exit(2);
  }

  // 直接复用判定逻辑，避免再起一个进程、也把 format 的输出接过来。
  const { evaluate, format } = await import("./audit-production.mjs");
  const result = evaluate(parsed);
  console.log(format(result));
  process.exit(result.blocking.length ? 1 : 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
