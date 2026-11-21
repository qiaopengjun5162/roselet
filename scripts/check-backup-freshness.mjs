#!/usr/bin/env node
/**
 * 站外检查「备份还新不新」：只读一个 backup-status.json，判断最近一次成功
 * 是否在有效期内。这个文件由 GitHub Actions 通过 SSH 从服务器读出来，经 stdin
 * 传进来——脚本本身不联网、不碰服务器、也不打印任何业务数据。
 *
 *   cat backup-status.json | node scripts/check-backup-freshness.mjs
 *   node scripts/check-backup-freshness.mjs /path/to/backup-status.json
 *
 * 为什么需要它：备份脚本每天在本机写 backup.log，但机器一旦出问题，日志跟
 * 告警一起没。检查必须跑在站外（GitHub runner），复用部署流水线已有的 SSH
 * 凭据。这是「报警者和被监控者不能在同一台机器」这条原则的第二次应用。
 *
 * **输出纪律**：仓库是 public，这些行会进 Actions 日志。所以只输出
 * 「ok / 距今多少小时 / 状态」这类元信息，绝不输出 dump 内容、用户数、行数。
 * 状态文件本身也只有一个固定结构，不含自由文本。
 *
 * 判定（任一条不满足就非 0 退出）：
 *   1. status === "ok"（最近一次运行整体成功）
 *   2. at 距今 < MAX_AGE_HOURS（默认 36h；每天备份，留一天余量给重试/错过）
 *   3. at 是能解析的时间、size 是正整数（挡住写坏/写一半的状态文件）
 */
export const DEFAULT_MAX_AGE_HOURS = 36;

/**
 * 纯函数，便于用假数据双向测试。
 * @returns {{ok: boolean, reasons: string[], ageHours: number|null}}
 */
export function evaluate(status, nowMs = Date.now(), maxAgeHours = DEFAULT_MAX_AGE_HOURS) {
  const reasons = [];
  if (!status || typeof status !== "object") {
    return { ok: false, reasons: ["状态文件不是对象"], ageHours: null };
  }
  if (status.status !== "ok") {
    reasons.push(`最近一次备份状态是 ${String(status.status)}`);
  }
  const at = typeof status.at === "string" ? Date.parse(status.at) : NaN;
  if (!Number.isFinite(at)) {
    reasons.push("状态文件的 at 无法解析");
    return { ok: false, reasons, ageHours: null };
  }
  const ageHours = (nowMs - at) / 3_600_000;
  // 未来的时间戳（时钟被改过）也当成不可信，和过期一样处理。
  if (ageHours < -1) {
    reasons.push("状态时间在未来，时钟可能被改过");
  } else if (ageHours >= maxAgeHours) {
    reasons.push(`最近一次成功备份已距今 ${ageHours.toFixed(1)} 小时（上限 ${maxAgeHours}）`);
  }
  if (!Number.isInteger(status.size) || status.size <= 0) {
    reasons.push("状态文件的 size 不是正整数");
  }
  return { ok: reasons.length === 0, reasons, ageHours };
}

async function readInput(path) {
  if (path) {
    const { readFile } = await import("node:fs/promises");
    return readFile(path, "utf8");
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export async function main(argv = process.argv.slice(2), nowMs = Date.now()) {
  const pathArg = argv.find((a) => !a.startsWith("--")) || null;
  const maxAgeHours = Number(
    argv.find((a) => a.startsWith("--max-age-hours="))?.split("=")[1]
      || process.env.BACKUP_MAX_AGE_HOURS
      || DEFAULT_MAX_AGE_HOURS,
  );
  const raw = (await readInput(pathArg)).trim();
  if (!raw) {
    console.error("没有读到状态文件内容");
    return 1;
  }
  let status;
  try {
    status = JSON.parse(raw);
  } catch {
    console.error("状态文件不是合法 JSON");
    return 1;
  }
  const result = evaluate(status, nowMs, maxAgeHours);
  if (result.ok) {
    const age = result.ageHours === null ? "?" : result.ageHours.toFixed(1);
    console.log(`OK 备份新鲜：最近一次成功距今 ${age}h（上限 ${maxAgeHours}h）`);
    return 0;
  }
  console.error("备份新鲜度检查失败：");
  for (const r of result.reasons) console.error(`  - ${r}`);
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error("check-backup-freshness 异常:", e);
    process.exit(2);
  });
}
