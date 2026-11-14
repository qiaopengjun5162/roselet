# Roselet 项目盘点与团队检查清单

> 生成日期：2026-11-14
> 依据：一次全仓只读盘点（功能完成度 / 代码质量 / CI 与生产就绪 / Web3 主网专项四路检查）+ 项目文档原文。所有结论带 `文件:行号`，关键数字已于生成当日复核。
> 用法：按第 3 节分头检查，在 `- [ ]` 打勾，把「实际结果」填回去，不确定的写「待确认」不要猜。

---

## 0. 一句话结论

**核心产品做完了、生产也跑着，但「发布流程」和「主网上线」两件事没闭环。**
现在最该做的不是加功能，而是：合主线 → 生产配置与发布流程收口 → 找真实用户试用。

阶段判断：**内测可用，但不是「主网就绪」，也不是「发布流程成熟」**。核心功能在 AWS Lightsail 上跑着，Web3 只是 Devnet / 本地验证闭环，主网进度为 0。

---

## 1. 现状快照（2026-11-14 实时核准）

| 项目 | 状态 | 依据 |
|---|---|---|
| 当前分支 | `codex/solana-mainnet-assessment` | `git branch --show-current` |
| 工作树 | 干净，无未提交改动 | `git status --short` |
| PR #7 | OPEN / Draft / MERGEABLE，未转正式 | `gh pr view 7`；https://github.com/qiaopengjun5162/roselet/pull/7 |
| 分支与 main 差距 | 21 个 commit、49 文件、+7607 −355 全部未合主线 | `git rev-list --count main..HEAD`、`git diff --shortstat main...HEAD` |
| CI | 最近两次全绿（4/4 job）：`42774870396`、`42773483053` | `gh run list` |
| 生产部署 | 两次 `Deploy Backend` 均为 `skipped`（分支非 main，未误触发） | 同上 |
| 测试量 | Web 286 / 小程序 66 / backend 94+1 ignored / recommend 153 | CI 日志、`DEVLOG.md` |
| 覆盖率 | statements 91.29 / branches 79.29 / functions 86.41 / lines 93.93，四项全过 | `apps/web/jest.config.ts:13-19` 门槛；CI run `42773483053` |

---

## 2. 完成度三档

### 2.1 已完成并可用

- 核心产品全链路：注册登录、种玫瑰、花圃、详情、送花、反馈、私密玫瑰、统计后台 —— `PROGRESS.md:279-305` 全部 `[x]`。
- 生产已上线：AWS Lightsail + Caddy 反代到 Rust Axum `:3001`，前端 Vercel / Cloudflare Pages —— `AGENTS.md`「当前实际生产后端路线」条、`docs/AWS_LIGHTSAIL_DEPLOYMENT.md`。
- 质量门禁：严格 clippy（全 workspace + 全目标 + `-D warnings`）、`cargo deny`、jest 四项覆盖率门槛、CI 4 job 全绿。
- Solana 浏览器 E2E 闭环：`pnpm verify:phantom:local` 在真实 Chromium + 本地 validator 上跑通「连接 → 浏览器内签名 → 广播 → 链上核验」—— `docs/SOLANA_MAINNET_ASSESSMENT.md:392-394`。

### 2.2 部分实现 / 仅在分支 / 需人工确认

- Web3 整条分支（21 commit）仍在 Draft PR #7，未合主线。
- 真 Phantom 扩展的人工手测**未做**，这是 PR 一直留 Draft 的原始理由 —— `SOLANA_MAINNET_ASSESSMENT.md:299`、`:386`。
- Solana / Base / Aleo 均停在 Devnet 或本地闭环：Aleo testnet program 未部署、Devnet USDC 真实结算未做 —— `PROGRESS.md:321-322`。
- 小程序基础完成，但微信登录与真机双令牌联调未做 —— `PROGRESS.md:310-311`。

### 2.3 明确写了未做 / 后置 / 暂缓

- `PROGRESS.md:307-322` 六项待办（注意 `:309`「部署上线」已过期，实际早已上线 Lightsail，建议清掉）。
- `docs/SOLANA_MAINNET_ASSESSMENT.md:63-96` 八组主网准备清单**全是 `- [ ]`**：主网付费 RPC、真 SOL、核验增强、密钥、存储去中心化、合规、内容审核。
- `DEPLOYMENT.md:327-336` 安全检查清单 8 项**全是 `- [ ]`**。
- `docs/AWS_LIGHTSAIL_DEPLOYMENT.md:528-539` Vercel 四个生产环境变量与服务器 `ADMIN_USER_IDS` 仍标「待完成」。
- `PRODUCT.md:74` 明确写着「当前唯一要做的事：找 5 个人试用」；`:68` 写着「DAU < 10000 不考虑 Web3」。

---

## 3. 分头检查清单（派活）

### A. 产品 / 运营

| # | 检查项 | 判定标准 | 依据 |
|---|---|---|---|
| A1 | 找 5 个真实用户试用，看会不会回来 | 5 人都有使用记录 + 回访结论 | `PRODUCT.md:74` |
| A2 | 走完 9 项人工冒烟 | 每项记录通过/失败：首页、注册登录、花圃、种花、从公开花圃进详情、我的花圃、About 提交反馈、管理员 `/stats` 能看到反馈、普通用户进不了 `/stats` | `docs/RELEASE_PROCESS.md:18-28` |
| A3 | 确认产品定位与 Web3 投入是否匹配 | 明确回答「先做用户验证，还是继续投主网」 | `PRODUCT.md:68`、`:74` 与最近 21 个 commit 几乎全在 Web3/门禁 |
| A4 | 多语言 Spike 是否需要 | 由 A1 的试用反馈决定，未反馈就先不做 | `PROGRESS.md:313` |

### B. 前端 / 钱包

| # | 检查项 | 判定标准 | 依据 |
|---|---|---|---|
| B1 | 真 Phantom 扩展人工手测（全程 Devnet，不碰真 SOL） | 5 步全部通过并记录 Phantom 版本与日期 | `SOLANA_MAINNET_ASSESSMENT.md:360-378` |
| B2 | 手测前置：钱包切 Devnet、前后端 RPC 指向同一端点、后端已启动 | 后端不设 `SOLANA_RPC_URL` 会返回 503，链上核验做不了 | `:366-368` |
| B3 | 5 步观察点 | ① 连接授权显示地址；② 轻量存证五步进度 + 后端有记录；③ 铸 NFT 弹窗是**一笔**交易、`supply=1/decimals=0/mintAuthority=null`；④ 刷新后 mint 地址仍在；⑤ 故意让后端保存失败，重试只重发 POST，**不重复广播、不铸第二枚** | `:372-378` |
| B4 | 三个风险点 | chain id 是否被接受、钱包是否保留 mint 已有签名、交易是否被重建（出现提示就记录版本、别反复重试） | `:380-384` |
| B5 | 测试 SOL 自备 | devnet/testnet `requestAirdrop` 2026-11-08 实测返回 410，水龙头停服 | `:386` |
| B6 | 手测通过后回填文档 | 把 `§11.3` 最后一行改 ✅ 并注明版本与日期，才具备「合主线 / 切主网」条件 | `:386` |
| B7 | 小程序微信登录 + 真机双令牌联调 | `wx.login()` → `/api/auth/wechat-login` 跑通，WASM 花瓣正常 | `PROGRESS.md:310-311` |

### C. 运维 / 发布

| # | 检查项 | 判定标准 | 依据 |
|---|---|---|---|
| C1 | Lightsail `.env.production` 核对 | 含 `POSTGRES_PASSWORD` / `JWT_SECRET` / `ADMIN_USER_IDS` / `ALLOWED_ORIGINS` 等，且**都没进 Git** | `AWS_LIGHTSAIL_DEPLOYMENT.md:431-446`、`AGENTS.md` 密钥红线 |
| C2 | `ADMIN_USER_IDS` 是否配置 | 未配置则 `/api/stats` 对所有登录用户返回 403 | `:539` |
| C3 | Vercel 四个生产环境变量 | `NEXT_PUBLIC_API_URL` / `AUTH_API_URL` / `READ_API_URL` 用 HTTPS，`WS_URL` 用 `wss://`；不能用 `http://47.131.238.0`（mixed content） | `:528-537`、`AGENTS.md` Vercel 条 |
| C4 | 服务器 Caddyfile 与仓库是否一致 | 以 `deploy/lightsail/Caddyfile` 为唯一共享源，服务器手改必须回写 | `AGENTS.md` Caddy 条 |
| C5 | 改环境变量后是否重建容器 | 不能用 `docker compose restart backend`（不会重建、旧变量残留），要读 `.current_backend_image` 显式重建 | `:541` |
| C6 | tag / Release / 回滚是否可用 | `RELEASE_PROCESS.md:5` 要求「按版本发布」，但现在 push main 自动部署，两者冲突；需确认 tag 驱动与回滚演练 | `docs/RELEASE_PROCESS.md:5`、`:30-42` |
| C7 | 变更检测会不会漏部署 | 当前只比较一个 commit，多 commit 推送需确认是否漏 | `.github/workflows/deploy-backend.yml` |
| C8 | 安全检查清单 8 项 | JWT≥32 字节、DB SSL、CORS 限生产域名、反代限流、定期备份、错误日志监控、`just audit`、`cargo update`/`pnpm update` | `DEPLOYMENT.md:327-336` |
| C9 | 版本元数据显示 | 关于页的版本/commit/构建时间能否追溯到 tag，别显示 `dev/unknown` | `AGENTS.md` 版本号条 |
| C10 | `SECURITY.md` 联系方式 | 邮箱仍是 `example.com` 占位，需替换 | `SECURITY.md` |

### D. 代码 / 质量

| # | 检查项 | 判定标准 | 依据 |
|---|---|---|---|
| D1 | 业务逻辑双份维护（最高优先） | Web 与小程序各自复制了颜色文案 / 日期格式化 / 音频策略 / 请求体构造，违反「跨端逻辑放 Rust WASM」；已因此出过 Memo 程序 ID 漂移的真实生产 bug | `AGENTS.md`「必须遵守」第 2-4 条；`apps/web/src/lib/recommend.ts:50,56,59,61,81,96-100,121-124,127`；`apps/miniprogram/src/utils/wasm.ts:46-69,105-112`；`DEVLOG.md` Memo 修复记录 |
| D2 | 最不可逆的链上路径没真单测 | `rose-memo.ts`、`chain.ts` 被组件测试整体 mock 掉，需补独立单测 | `apps/web/src/lib/`；对照片段已由 `rose-nft.test.ts` 补到 100% |
| D3 | live RPC 测试长期 `#[ignore]` | 唯一一处 `#[ignore]`，需约定「何时手动跑、谁跑」 | `crates/backend/src/routes/solana_nft.rs:668` |
| D4 | 生产路径 panic 风险 | 非测试代码 37 处 `.unwrap()` / `.expect()` / `panic!` / `unsafe`，其中 22 处集中在 `crates/recommend/src/lib.rs`；WASM 序列化失败或锁中毒会 panic | 当日复核统计；`crates/backend/src/rate_limit.rs` |
| D5 | 超长生产文件拆分 | `solana_onchain.rs` 905、`solana_nft.rs` 687、`recommend/lib.rs` 645、`api.ts` 540、`plant/page.tsx` 471、`emotion.rs` 462、`garden.rs` 449、`membership-panel.tsx` 429；优先拆 `solana_onchain.rs`（里面还混着读前端 TS 的契约测试） | 当日复核统计 |
| D6 | CI 缺的门禁 | Rust 覆盖率、`forge test` 合约测试、E2E、镜像扫描、`pnpm audit --prod`、Dependabot（`SECURITY.md:109` 声称有，实际无 `dependabot.yml`） | `.github/workflows/` |
| D7 | 小程序侧类型宽松 | 8 处显式 `any` + 2 处手写 `eslint-disable`（Web 侧手写 TS 为 0 any） | `apps/miniprogram/src/` |

**不用动**：测试代码里的 `unwrap`、wasm-bindgen 生成物里的 `any`/TODO（手改会被 `just agent-wasm` 覆盖）。

### E. 决策层（需要拍板，不是执行项）

- [ ] **E1**：PR #7 是否转 ready-for-review 并合主线？CI 已全绿、MERGEABLE，但 B1 手测未做。合主线会触发 `Deploy Backend` 的 `workflow_run`，属于生产动作。
- [ ] **E2**：主网化是否单独立项？`SOLANA_MAINNET_ASSESSMENT.md:141-146` 的建议是「先在 Devnet 验证 PMF，再走阶段 1」，且 `PRODUCT.md:68` 明确 DAU<10000 不考虑 Web3。
- [ ] **E3**：先做哪个代码项？我建议 D1（双份兜底收敛）优先于 D5（拆文件）。

---

## 4. 建议顺序（我的判断）

1. **合主线**：PR #7 CI 已全绿，21 个 commit 长期悬在分支上本身就是风险。合之前先做 B1 手测，或者明确接受「手测后补」。
2. **生产配置与发布流程收口**：C1-C9，尤其 `ADMIN_USER_IDS`、Vercel 四个变量、tag 驱动发布。
3. **找 5 个真实用户**（A1 + A2）：`PRODUCT.md:74` 说这是当前唯一要做的事。
4. **代码质量**：D1 → D2 → D3，守住覆盖率四项门槛和严格 clippy。
5. **主网化单独立项**，别混在日常迭代里。

一句话提醒：这里有个**错配** —— 产品文档说「先验证有没有人用」，但最近 21 个 commit 几乎全扑在 Web3 和门禁上。门禁补齐是好事，但它不是产品目标。

---

## 5. 本次盘点没有动的东西（边界）

- 没有修改任何产品代码、配置或工作流。
- **没有**合 PR #7（会触发生产部署，属不可逆外部动作）。
- **没有**做 D1 重构（跨 Web / 小程序 / WASM 的大改）。
- 只新增了本清单文档，并按项目规则 commit + push；纯文档变更不会触发 `Deploy Backend`。

---

## 附：数字怎么来的（可复核）

```bash
git branch --show-current; git status --short
gh pr view 7 --repo qiaopengjun5162/roselet --json number,state,isDraft,mergeable
gh run list --repo qiaopengjun5162/roselet --limit 4
git rev-list --count main..HEAD; git diff --shortstat main...HEAD

# 手写源码 TODO/FIXME = 0
 grep -rnE "TODO|FIXME|HACK|XXX" apps/web/src apps/miniprogram/src crates/*/src apps/agent-api/src | wc -l

# 生产路径 panic 风险点 = 37（按文件截断 #[cfg(test)] / mod tests 后统计）
# 唯一 #[ignore] 测试
grep -rn "#\[ignore" crates/*/src --include="*.rs"
```

覆盖率与测试量以 CI run `42773483053` / `42774870396` 日志为准；主网结论以 `docs/SOLANA_MAINNET_ASSESSMENT.md` §4、§7、§12.3、§13 为准。
