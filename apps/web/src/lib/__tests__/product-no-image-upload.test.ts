/**
 * 产品边界守卫：普通模式不得出现「上传图片」入口。
 *
 * 产品一句话是「写一句，种一朵玫瑰，一周后看看自己长出了什么」——里面没有图片。
 * 现状（2026-11-18 核准）：全站唯一的选图控件在会员版上链面板，流程是
 * 「选图 → IPFS/Pinata → CID → 写进 Solana Memo 链上记录」，不是给玫瑰配图；
 * 玫瑰主表也没有图片列；生产未配置 PINATA_JWT 时该上传还会返回 503。
 * 结论：普通版不加图片上传，这条边界由本文件守住。
 *
 * 手法与 product-one-liner.test.ts / crates/recommend/src/contract.rs 一致：读源码
 * 断言。放 Web 侧是因为 crates/recommend/** 命中 deploy-backend.yml 的 should_deploy
 * 路径，为一条静态边界重启生产后端不划算；Web 测试照样被 just ci-local 与 CI 跑到。
 * AGENTS.md：纸面规则不算数，新增约束要问「哪条自动检查会在它再被破坏时报错」。
 *
 * 只扫 UI 层的 .tsx：用户能不能传图取决于有没有选图控件；apps/web/src/lib/api.ts
 * 只是服务端代理封装（不含 UI），不进扫描。可见性另由 MemberOnly 保证，见
 * components/__tests__/member-only.test.tsx。
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

/** 用户能碰到图片的 UI 信号：选图控件、上传 API、小程序选图。 */
const UPLOAD_UI_SIGNAL =
  /type\s*=\s*["']file["']|accept\s*=\s*["']image\/|uploadImageToIpfs|api\/ipfs\/upload|chooseImage|chooseMedia/;

/** 给 roses 表加图片列的信号（cid 用词边界，避免误伤其它单词）。 */
const IMAGE_COLUMN = /\b(image|photo|picture|image_cid|ipfs_cid|cid)\b/i;

const MEMBER_PANEL = "apps/web/src/components/membership-panel.tsx";
const MIGRATIONS = "crates/backend/migrations";

/** 递归收集 UI 源码（跳过测试、生成物与覆盖率产物）。 */
function listUiSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (["__tests__", "node_modules", "dist", ".next", "coverage"].includes(entry.name)) {
        continue;
      }
      found.push(...listUiSources(path));
    } else if (/\.tsx$/.test(entry.name) && !/\.pw\.tsx$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

const uploadHits = (dir: string) =>
  listUiSources(dir).filter((file) => UPLOAD_UI_SIGNAL.test(read(file))).sort();

describe("产品边界：普通模式零图片上传", () => {
  it("扫描器自检：会员版面板确实含选图控件（防止正则失灵造成假绿）", () => {
    expect(UPLOAD_UI_SIGNAL.test(read(MEMBER_PANEL))).toBe(true);
    expect(read(MEMBER_PANEL)).toContain(
      'accept="image/png,image/jpeg,image/webp,image/gif"',
    );
  });

  it("Web 里唯一能选图的地方只有会员版上链面板", () => {
    expect(uploadHits("apps/web/src")).toEqual([MEMBER_PANEL]);
  });

  it("小程序也没有图片上传入口", () => {
    expect(uploadHits("apps/miniprogram/src")).toEqual([]);
  });

  it("玫瑰主表没有图片列，后续迁移也不许给它加", () => {
    // 001 建表：只有颜色、三句话与时间。
    expect(IMAGE_COLUMN.test(read(`${MIGRATIONS}/001_create_rose.sql`))).toBe(false);

    // 已发布的 migration 不能改（sqlx checksum），给 roses 加列只能靠新的
    // ALTER TABLE roses；逐个文件扫，防止有人绕过 001 的断言。
    const migrations = readdirSync(resolve(ROOT, MIGRATIONS))
      .filter((name) => name.endsWith(".sql"))
      .map((name) => `${MIGRATIONS}/${name}`);
    const roseAlters = migrations.filter((file) =>
      /\bALTER\s+TABLE\s+roses\b/i.test(read(file)),
    );
    expect(roseAlters.length).toBeGreaterThan(0); // 自检：确实扫到了改表语句
    for (const file of roseAlters) {
      expect(IMAGE_COLUMN.test(read(file))).toBe(false);
    }

    // CID 只允许留在链上铸币记录表，不准挪进 roses 变成「玫瑰配图」。
    expect(read(`${MIGRATIONS}/013_create_solana_mints.sql`)).toContain("ipfs_cid");
  });
});
