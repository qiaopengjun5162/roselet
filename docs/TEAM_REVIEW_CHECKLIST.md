# Roselet 项目盘点与团队检查清单

> 生成日期：2026-11-14；**§0 / §1 已于 2026-11-17 更新为新会话入口（一页纸现场快照）**。
> 依据：一次全仓只读盘点（功能完成度 / 代码质量 / CI 与生产就绪 / Web3 主网专项四路检查）+ 项目文档原文。所有结论带 `文件:行号`，关键数字已于生成当日复核。
> 用法：新会话先读 §0 / §1；派活按第 3 节分头检查，在 `- [ ]` 打勾，把「实际结果」填回去，不确定的写「待确认」不要猜。历史进展看 §6，细节看 `DEVLOG.md`。

---

## 0. 一句话结论（2026-11-17 更新；新会话先读这一节）

**代码侧已经干净、四关 CI 全绿；现在真正缺的不是功能，是「有没有人真的会用」。**

`PRODUCT.md` 写着「当前唯一要做的事：找 5 个人试用，看他们会不会回来」，`README.md` 自评 `User validation 20%`；但最近 35 个提交几乎全在 Web3、门禁、契约测试上。**别把「工程流程做得更漂亮」当成项目进展。**

**现在最该做的三件事（都要真人，不是代码）**
1. **找 5 个真实用户试用，看会不会回来** ← 最高优先级，也是唯一能验证产品的事
2. 用真的 Phantom 扩展手点一遍上链（现有 `verify:phantom*` 跑的是注入的假钱包 + 本地 validator）
3. 决定是否合 PR #7 —— 这一步等于部署生产后端，不可逆，需人拍板

**这轮先别做**：继续堆 Web3 / 门禁 / 重构；`MembershipPanel` 拆分、付费会员权限、主网化、`chrono` 迁移都等第 1 项有结果再排期。理由与逐条对照见 §6.9。

阶段判断：内测可用、生产在跑；Web3 只到 Devnet / 本地验证闭环，主网进度 0；发布流程已有 `docs/RELEASE_PROCESS.md` 但尚未按它走完一次正式发布。

---

## 1. 现状快照（2026-11-17 实时核准）

| 项目 | 状态 | 依据 |
|---|---|---|
| 当前分支 | `codex/solana-mainnet-assessment`，工作树干净，本地/远端同为 `382149f` | `git status --short`、`git rev-parse HEAD`、远端 ref API |
| PR #7 | OPEN / Draft / MERGEABLE，2026-11-17 有更新 | `gh pr view 7`；https://github.com/qiaopengjun5162/roselet/pull/7 |
| 分支与 main 差距 | 领先 35 个 commit、78 文件、+9352 −455，全部未合主线 | `git rev-list --left-right --count origin/main...HEAD`、`git diff --shortstat origin/main...HEAD` |
| CI | run `44110631326` 四个 job 全 `success` | `gh run view 44110631326` |
| 生产部署 | `Deploy Backend` 为 `skipped`（分支非 main，未误触发） | `gh run list`；`.github/workflows/deploy-backend.yml:25` |
| Web 测试 | 全量 `jest --coverage` 44 套件 / 326 例全过 | 本地全量运行 + CI |
| 覆盖率 | statements 91.85 / branches 80.11 / functions 87.24 / lines 94.39，四项全过（门槛 90/70/85/90） | `apps/web/jest.config.ts` |
| Rust 契约 | `cargo test -p roselet-recommend contract` 6 例；严格 clippy / fmt / `cargo deny` 全 0 | 本地 + CI |
| 用户验证 | **仍是 0**：5 人试用未开始 | `PRODUCT.md:74`、`README.md` 进度条 |

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
| D1 | 双份兜底收敛（**第一步已完成，见 §6.3**；结论已修订，见 §6.2） | Web 与小程序各有一套降级兜底（颜色文案 / tips / 音频策略 / 请求体），容易漂移；已因此出过 Memo 程序 ID 不一致的真实生产 bug。**已装网**：4 个 Rust↔TS 契约测试锁住颜色三元组、未知颜色兜底、tips 文案，并抓到且修复了未知颜色 `🌸`↔`🌹` 的真实漂移。**仍待做**：把兜底数据抽到已有的 `@roselet/core`（Web 尚无 workspace 依赖）。注意这些是「WASM 不可用」时的兜底，不能简单搬进 WASM | `AGENTS.md`「必须遵守」第 2-4 条；`crates/recommend/src/contract.rs`；`apps/web/src/lib/recommend.ts:50-61,96-100,121-124,151-157`；`apps/miniprogram/src/utils/wasm.ts:46-69,105-114`；`DEVLOG.md` Memo 修复记录 |
| D2 | ~~最不可逆的链上路径没真单测~~ **已完成（见 §6）** | `rose-memo.ts`、`chain.ts` 曾被组件测试整体 mock 掉，现已各有独立单测（22 例） | `apps/web/src/lib/__tests__/rose-memo.test.ts`、`chain.test.ts` |
| D3 | live RPC 测试长期 `#[ignore]` | 唯一一处 `#[ignore]`，需约定「何时手动跑、谁跑」 | `crates/backend/src/routes/solana_nft.rs:668` |
| D4 | 生产路径 panic 风险 | 非测试代码 37 处 `.unwrap()` / `.expect()` / `panic!` / `unsafe`，其中 22 处集中在 `crates/recommend/src/lib.rs`；WASM 序列化失败或锁中毒会 panic | 当日复核统计；`crates/backend/src/rate_limit.rs` |
| D5 | 超长生产文件拆分 | `solana_onchain.rs` 905、`solana_nft.rs` 687、`recommend/lib.rs` 645、`api.ts` 540、`plant/page.tsx` 471、`emotion.rs` 462、`garden.rs` 449、`membership-panel.tsx` 429；优先拆 `solana_onchain.rs`（里面还混着读前端 TS 的契约测试） | 当日复核统计 |
| D6 | CI 缺的门禁 | Rust 覆盖率、`forge test` 合约测试、E2E、镜像扫描、`pnpm audit --prod`、Dependabot（`SECURITY.md:109` 声称有，实际无 `dependabot.yml`） | `.github/workflows/` |
| D7 | 小程序侧类型宽松 | 8 处显式 `any` + 2 处手写 `eslint-disable`（Web 侧手写 TS 为 0 any） | `apps/miniprogram/src/` |

**不用动**：测试代码里的 `unwrap`、wasm-bindgen 生成物里的 `any`/TODO（手改会被 `just agent-wasm` 覆盖）。

### E. 决策层（需要拍板，不是执行项）

- [ ] **E1**：PR #7 是否转 ready-for-review 并合主线？CI 已全绿、MERGEABLE，但 B1 手测未做。合主线会触发 `Deploy Backend` 的 `workflow_run`，属于生产动作。
- [ ] **E2**：主网化是否单独立项？`SOLANA_MAINNET_ASSESSMENT.md:141-146` 的建议是「先在 Devnet 验证 PMF，再走阶段 1」，且 `PRODUCT.md:68` 明确 DAU<10000 不考虑 Web3。
- [ ] **E3**：D2 已完成、D1 的契约测试已完成，剩「兜底抽到 `@roselet/core`」。下一步做哪个？建议先收尾 D1（共享包抽取），再 D5 拆文件；但这会动 `apps/web/package.json` 与 lockfile，需单独排期。

---

## 4. 建议顺序（我的判断）

1. **合主线**：PR #7 CI 已全绿，21 个 commit 长期悬在分支上本身就是风险。合之前先做 B1 手测，或者明确接受「手测后补」。
2. **生产配置与发布流程收口**：C1-C9，尤其 `ADMIN_USER_IDS`、Vercel 四个变量、tag 驱动发布。
3. **找 5 个真实用户**（A1 + A2）：`PRODUCT.md:74` 说这是当前唯一要做的事。
4. **代码质量**：D2 已完成；D1 的契约测试已完成、剩共享包抽取；然后 D3。守住覆盖率四项门槛和严格 clippy。
5. **主网化单独立项**，别混在日常迭代里。

一句话提醒：这里有个**错配** —— 产品文档说「先验证有没有人用」，但最近 21 个 commit 几乎全扑在 Web3 和门禁上。门禁补齐是好事，但它不是产品目标。

---

## 5. 盘点轮次的边界（2026-11-14 白天）

- 没有修改任何产品代码、配置或工作流。
- **没有**合 PR #7（会触发生产部署，属不可逆外部动作）。
- **没有**做 D1 重构（跨 Web / 小程序 / WASM 的大改）。
- 盘点轮次只新增了本清单文档，并按项目规则 commit + push；纯文档变更不会触发 `Deploy Backend`。
- 后续轮次的改动见 §6：D2 仅新增测试；D1 第一步新增契约测试，并修正 4 处 TS 兜底字面量与 1 处写死旧值的既有断言（属行为修正，不是重构）。全程未碰配置 / 工作流 / 依赖，也未合 PR #7。

---

## 6. 后续进展（2026-11-14 晚）

### 6.1 D2 已完成：链上不可逆路径补真单测

新增 `apps/web/src/lib/__tests__/rose-memo.test.ts`（10 例）与 `chain.test.ts`（12 例），共 22 例；本地 `jest` 全过、`tsc --noEmit` RC=0、`eslint` RC=0。锁住两处服务端会校验的编码契约：

- `sendRoseMemo`：必须显式传 `{ programAddress: MEMO_PROGRAM_ADDRESS }`，禁止 SDK 默认的 `Memo4c2pN8…`（浏览器 E2E 抓到过的真实生产 bug）；compute-budget 指令顺序（先 limit 后 price）、`skipPreflight: true` / `maxRetries: 5`，以及「本函数不等 finality，超时不重播」的边界。
- `mintRoseMemorial`：`roseId → bytes32`、颜色 `red/white/yellow → 0/1/2`、必须切 Base Sepolia、等 1 个确认；无钱包 / 无账户 / 地址无效 / 颜色非法 / 编号非法 / 回执失败全部抛错，不静默当成功。

**CI 结果（run `43603278426`，commit `b33fc1f`）：四个 job 全部 success。** Frontend 41 suites / 308 tests 全过，全局覆盖率 `statements 91.51%` / `branches 79.53%` / `functions 86.78%` / `lines 94.1%` 四项全过（较补测前的 91.29% 继续提升）；`chain.ts` 与 `rose-memo.ts` 双双 **100% 全项**。小程序 66 tests / 99.33%，Agent API 97.25%。

### 6.2 D1 重新评估：不能简单「搬进 Rust WASM」

复核源码后发现，所谓「双份业务逻辑」主要是 **WASM 加载失败或调用抛错时的降级兜底**：`apps/miniprogram/src/utils/wasm.ts:46-69`（`buildPlantBody` fallback）、`:105-112`（`COLOR_FALLBACK`）、`apps/web/src/lib/recommend.ts:50-61`（tips fallback）、`:96-100`、`:121-124`。**WASM 都不可用时，放在 WASM 里的兜底同样跑不了**，所以「把兜底搬进 WASM」逻辑上不成立，上表 D1 的笼统描述已据此修订。

正确的收敛方向：

1. 兜底**数据与纯函数**抽到跨端共享包（项目已有 `packages/core` / `@roselet/core`，小程序已引用其类型），Web 与小程序都从那里取，消除两份硬编码；
2. 加**契约测试**锁住 fallback 与 Rust WASM 正常输出一致（复用 `crates/backend/src/routes/solana_onchain.rs` 的 `frontend_memo_contract_matches_backend` 模式：运行时读前端 TS 断言常量），防住 Memo 程序 ID 那类漂移；
3. Rust WASM 继续做唯一权威实现，TS 侧只保留「不可用时的最小降级」。

第 2 步（契约测试）已于本轮完成，见 §6.3；第 1 步（共享包抽取）**仍未动**：Web 侧尚无 `@roselet/core` 的 workspace 依赖（只有 `next.config.ts:8` 的 `transpilePackages`），需要改 `apps/web/package.json` 与 `pnpm-lock.yaml` 并验证两端打包，不宜顺手改。

### 6.3 D1 第一步已落地：Rust↔TS 兜底契约测试

新增 `crates/recommend/src/contract.rs`（4 个 `#[test]`，`lib.rs` 挂 `#[cfg(test)] mod contract`），复用后端 `frontend_memo_contract_matches_backend` 的模式：测试时按 `CARGO_MANIFEST_DIR` 读两份前端 TS 源码，逐项与 Rust 权威函数比对：

| 测试 | 锁住什么 |
|---|---|
| `web_colour_fallbacks_match_rust_wasm` | `recommend.ts` 的 `_CE` / `_CL` 与 `color_emoji` / `color_label` 一致 |
| `miniprogram_colour_fallbacks_match_rust_wasm` | `wasm.ts` 的 `COLOR_FALLBACK` 三元组、顺序与 Rust `COLORS` 一致 |
| `unknown_colour_fallbacks_match_rust_wasm` | 两端未知颜色的最终兜底字面量等于 Rust `find()` 的回退值 |
| `web_tip_fallbacks_are_copied_from_rust_authority` | Web 的 home/login/plant/garden 兜底文案必须是 `tips.rs` 权威文案池的成员，且 4 个 context 齐全 |

**抓到并修复了一处真实漂移**：`color.rs:29-31` 的 `find()` 对未知颜色回退到首个注册色（🌹 / 红玫瑰），但两端 TS 兜底回退到 `🌸` / 原始 color 值；更麻烦的是 `recommend.test.ts:244-245` **把旧的错误值写死成了断言**，等于把漂移固化了。现已把 4 处兜底与那 1 处断言统一到 Rust 语义，并在 TS 侧加注释指明契约测试会读这些字面量。

**有效性验证**：先让测试在真实漂移下跑出 `1 failed`（`left: Some("🌸") / right: Some("🌹")`）；再做 3 组 mutation（改 Web 颜色 emoji、改小程序颜色 label、改 tips 文案），3 条静态测试分别 `FAILED`、全部 `CAUGHT`，随后自动恢复源码并重跑 `4 passed`。

本地门禁：`cargo fmt --all -- --check` RC=0、严格 clippy RC=0、`cargo test --workspace --lib` → backend 94+1 ignored / recommend **157 passed**（含新增 4）；Web `recommend.test.ts` 10 passed、`eslint` RC=0、`tsc --noEmit` RC=0；小程序 `wasm.test.ts` 1 passed、`tsc --noEmit` RC=0。

**仍未覆盖的「行为型」兜底**（契约测试只能锁常量 / 文案，锁不了构造逻辑，需等共享包抽取后靠单一实现解决）：Web `recommend.ts:98,102` 音频策略、`:123-124` `buildGardenUrl`、`:129-131` `buildPlantBody`；小程序 `wasm.ts:47-54` `buildPlantBody`、`:112` `colorOptions`。另外 UI 里还有硬编码颜色选项（`plant/page.tsx:15`、`garden/page.tsx:12`），不属于 WASM 兜底，是另一类双份维护。

### 6.4 CI 结果与一次确定性的 push 解法

**CI 结果（run `43607696977`，commit `8a2fc6e`）：四个 job 全部 success。** Frontend 41 suites / 308 tests 全过，全局覆盖率 `statements 91.51%` / `branches 79.53%` / `functions 86.78%` / `lines 94.1%` 四项全过（与补测前持平）；`recommend.ts` 100% stmts/funcs/lines。Miniprogram 66 tests / 99.33%，Agent API 97.25%。4 个新契约测试在 CI 全新环境同样通过（recommend 157 passed）。

**push 的确定性解法**：这次沙盒代理连续 `HTTP2 framing layer` / `CONNECT 502`，`http.version=HTTP/1.1`、清掉 env 代理直连（75s 超时）都失败；最终 `git -c http.proxy=http://127.0.0.1:7890 push origin HEAD` 一次成功——本机 Clash 代理可用。以后遇 502 不必盲目重试，直接用这条；推完仍用 `gh api repos/<owner>/<repo>/git/ref/heads/<branch>` 对齐本地 `git rev-parse HEAD`，别把「本地已 commit」当成「已推送」。

### 6.5 D1 收尾完成：共享兜底单一实现（2026-11-15）

§6.2 第 ① 步落地。两端 WASM 不可用时的兜底数据 / 纯函数，全部收敛到已有的 `@roselet/core`（`packages/core/src/fallbacks.ts`），Web 与小程序改从该包取，删掉本地硬编码。

- 新增共享源：`COLOR_META`（红/白/黄，顺序 = Rust `COLORS`）、`TIPS`（4 context，逐字取自 `tips.rs`）、`audioPlaybackPolicy` / `buildGardenUrl` / `buildPlantBody` 兜底纯函数，按 Rust WASM 权威语义实现。
- Web 接包：`apps/web/package.json` 加 `workspace:*` 依赖 + `jest.config.ts` mapper + `tsconfig.json` paths；`pnpm-lock.yaml` 补 importer。Web 侧 `next.config.ts:8` 已有 `transpilePackages: ["@roselet/core"]`，无需改动。
- **小程序构建链（本节初版结论有误，已订正）**：`config/index.ts` 原先的 `chain.module.rule("ts").include.add(/packages\/core/)` 挂在**不存在的 `ts` rule** 上，是静默 no-op；之前判「早已预埋、无需改构建链」是错的。改成值导入后 `@roselet/core`（`main` 指向未编译的 `src/index.ts`）第一次真正进入 webpack 打包图，直接 `ModuleParseError`。最终修法见 §6.6。
- 契约测试升级为「单源守卫」：`contract.rs` 新增 `frontends_import_shared_fallbacks`（确认两端不再硬编码、已引共享包）+ `shared_behaviour_fallbacks_keep_rust_semantics`（读 `fallbacks.ts` 锁住 3 类行为输出）；新增 `apps/web/src/lib/__tests__/core-fallbacks.test.ts`。

**本次又修复 3 处真实语义漂移**（行为不一致，非纯重复）：`buildPlantBody` 跳过 null 字段、`buildGardenUrl` 省略 `color=all`、未知颜色兜底 `🌹`/`红玫瑰`（且 `recommend.test.ts` 旧断言已把错误值固化，一并改正）。

提交 `3c5e683`，远端 SHA `3c5e6834ed41c97e3bbe8e46c0cf62e96f1a8c76`。此后 CI 连红两次（clippy 文档 lint、小程序构建链），均已在 §6.6 记录并修复。**最终 CI（run `43702959085`，commit `1e5ddfa`）四个 job 全部 success，重新全绿**；PR #7 保持 `Draft + MERGEABLE`。

**§6.3 末尾「仍未覆盖的行为型兜底」现已收敛**——那一批全部改为调用 `@roselet/core`，靠单一实现消除双份维护。当时单独留下的 UI 层硬编码颜色选项（`plant/page.tsx:15`、`garden/page.tsx:12`）已在 §6.7 收口，不再存在。

### 6.6 两处只在 CI 暴露的问题（2026-11-15，均已修复）

`3c5e683` 之后本地门禁全绿但 CI 连红两次，都是本地盲区：

| run | 失败 job | 根因 | 修复 |
|---|---|---|---|
| `43677042851` | Backend clippy | `contract.rs:16` 模块文档 bullet 后未缩进文字，clippy 1.100 `doc-lazy-continuation`（`-D warnings` 下报 `exit 101`）；本地同版本但命中缓存没报 | 列表与末段间加空 `//!` 行（`6596d34`） |
| `43677473995` | Miniprogram Build | `ModuleParseError: Unexpected token / export type`，来自 `packages/core/src/fallbacks.ts`。`@roselet/core` 的 `main` 是未编译 `src/index.ts`，改值导入后首次进入 webpack 打包图；Taro v4 真正跑 babel-loader 的 rule 名是 **`script`**（`MiniWebpackModule.js:159`），原 `rule("ts")` 是空 rule 从未生效 | `mini.webpackChain` 里 alias 到 `packages/core/src` + `rule("script").include.add(coreSrc)`；CI `build.yml:142` 只跑 `build:weapp`，改 mini 即可 |

本地验证：`NODE_OPTIONS=--max-old-space-size=6144 taro build --type weapp` → `✔ Webpack Compiled successfully`、RC=0。详见 `DEVLOG.md`「D1 收尾后连修两处 CI 红」。

**给检查者的提醒**：① 本地 clippy/tsc/jest 全绿 ≠ CI 绿，push 后必须确认新 run；② webpackChain 挂 `.rule(name)` 前先确认 name 存在，挂错是静默 no-op；③ 「共享包从 `import type` 改成值导入」必须两端都跑**生产构建**，光过单测/类型检查不够。

### 6.7 最后一处双份维护已收口，代码侧盘点全部闭环（2026-11-15 晚）

§6.5 边界里留的「UI 层硬编码颜色选项」已处理：`plant` / `garden` / `profile` 三页不再各存颜色表，`plant` 的推荐色三元硬编码也删掉，统一组合 `@roselet/core` 的共享数据，仅保留 UI 专属样式；`contract.rs` 新增 `web_ui_pages_use_shared_colour_metadata` 守卫，防止以后再复制。至此颜色元数据只剩一份：Rust WASM（权威）→ `@roselet/core`（共享兜底）→ 两端 UI。

提交 `3ec602c`，CI run `43723942421`（headSha `3ec602c…`）`conclusion: success`，四个 job 全部 success；`Deploy Backend` 仍 skipped。

**结论：§6.2 / §6.3 / §6.5 / §6.6 / §6.7 的代码侧盘点项全部闭环，工作树干净、分支与远端一致。** 剩下的是需要真人 / 决策的事项，按建议顺序：① 找 5 个真实用户试用（`PRODUCT.md:74` 写「当前唯一要做的事」）；② 真 Phantom 扩展人工手测（现有 `verify:phantom*` 是注入 fake wallet + 本地 validator 的 E2E，真扩展签名尚未人验）；③ 合 PR #7 —— `.github/workflows/deploy-backend.yml:25` 只在 `head_branch == 'main'` 且 CI success 时部署生产后端，所以这一步是**不可逆的外部动作**，需明确拍板；④ 主网化单独立项。

### 6.8 会员版边界修复 + 剩余可优化项（2026-11-17）

**已修**：`CLAUDE.md` 早就规定「默认普通模式零 Web3 痕迹」，但实现漏了四处（首页 / 种花页的 Aleo 链接、`/private-vault` 整页、详情页 `RoseMemorial`）。本轮新增统一门闩 `MemberOnly` + 会员版状态条 `MembershipBanner`，把四条入口全部收进去；`/private-vault` 非会员直接输网址也只显示切换提示，且**不实例化 Aleo 钱包适配器**；右上角入口文案改「🌐 会员版」。详见 `DEVLOG.md`「前端会员版边界修复」。

本地门禁：Web `tsc` 0、`eslint` 0、全量 `jest --coverage` 44 套件 326 例、覆盖率 `91.85 / 80.11 / 87.24 / 94.39`（过 90/70/85/90 门槛）；Rust fmt / 严格 clippy 0。

**检查后仍发现、但本轮未做的可优化项**（按优先级）：

| # | 项 | 说明 / 建议 |
|---|---|---|
| 1 | `isMember` 只是前端开关，不是权限 | 任何人点一下就进会员版。当前零成本验证阶段可接受；若做付费会员，必须后端判定 + 上链接口服务端鉴权，前端开关防不住绕过 |
| 2 | `MembershipPanel` 430 行 | UI、Solana 交易编排、IPFS 上传、重试状态机混在一起；建议拆 `useRoseMemoMint` hook + 纯展示组件，提升可测性 |
| 3 | 会员模式不持久化 | 刷新回普通版（= 默认零 Web3，更安全），但会员用户每次要重点。要做的话用 localStorage + `useEffect` 恢复，注意 hydration |
| 4 | 首页 / 种花页 Aleo 链接仍各写一份 | 已统一过门闩，但文案样式双份；可抽 `AleoVaultLink` |
| 5 | 普通模式详情页仍请求 `getRoseMemorial` | 只读后端记录、不展示，属无谓请求；可在 effect 里按会员 gate |
| 6 | CI 两条弃用提醒 | Node.js 20 action 被强制跑在 Node 24；ubuntu-latest 将迁 Ubuntu 26。当前不阻断，升级时处理 |
| 7 | `chrono` 无人维护 | `RUSTSEC-2026-0543` 已在本轮 `deny.toml` 显式豁免（公告写「无安全升级可用」）；真正解法是迁移到 `jiff` / `time`，需单独排期 |

**结论**：用户主诉（Web3 不该默认暴露）已解决；上表 1 是真正需要产品决策的边界，2–5 属代码整洁度，可下一轮排期。

### 6.9 对照腾讯开源 LoopForge 文章：可以借鉴什么、不可以照搬什么（2026-11-17）

**文章**：《登上 GitHub Trending｜腾讯开源 LoopForge》（公众号「腾讯开源」，2026-11-17）。讲团队级 AI 研发平台的五步演进：① 云端 7×24 工作区 ② 共享会话 + 唯一 Main Bot + 三挡权限代批 ③ 工程级 SOP（五层标准 / 客观门禁当场自愈 / 主副驾随时接管） ④ 定时巡检与 Issue 全链路自动化 ⑤ 工程级 RSI（复盘开处方 → 改写 SOP 与门禁）。最值钱的一句：**「把人的工程经验转化为系统的运行秩序」**。

**总判断：不要照搬。** 文章治的是「团队用 AI 写代码时，人的注意力成了瓶颈」；本项目的瓶颈恰好相反——代码与门禁已经过剩，**用户验证为 0**（`PRODUCT.md:74` 写「当前唯一要做的事：找 5 个人试用」，最近 35 个提交几乎全在 Web3 / 门禁 / 契约测试）。照 L1→L5 往上堆只会把偏差放大。§0 列的三件事没有一件是靠写代码解决的。

| 文章做法 | 本项目现状 | 判断 / 本轮动作 |
|---|---|---|
| ③ 客观门禁「不通过绝不放行」 | clippy / cargo deny / 覆盖率门槛 / Rust↔TS 契约测试都在；上一轮还刚把「零 Web3 痕迹」从纸面规则变成门闩测试 | **已具备，别重复加**。真缺口是「本地跑的门禁 ≠ CI 跑的门禁」：`just pre-commit` 漏了 Web 覆盖率与小程序 `taro build`，两次造成 CI 红 → 本轮补 `just ci-local` |
| ⑤ 复盘开处方、改写流程，下次不再踩 | DEVLOG 5094 行 + §6.6 复盘齐全，但三次 CI 红都只修了坏的那一行；还出现过复盘结论写错要事后订正 | **能借，本轮落地**：`AGENTS.md` / `CLAUDE.md` 写死「每次 CI 红必须落一条防复发的可执行检查」，并让 `just ci-local` 成为默认载体 |
| ② 一个共享会话 / 同一个现场 | 单人 + AI，无多人割裂；但跨会话割裂真实存在：日志 5094 行、规则分散两份、用户反复说「继续」 | **能借，本轮落地**：不新建文档（多一份只会更割裂），把 §0 / §1 更新成一页纸现场快照，`AGENTS.md` 指定新会话先读 |
| ④ 定时巡检、无人值守 | CI 只在 push / PR 触发；`chrono` 公告正是「没改代码却变红」才被发现；两条弃用提醒一直挂着 | **能借，本轮没做**：加每周定时审计 workflow 属运维策略变更、会持续产生运行记录，需你点头。它闭环的正是第三次 CI 红 |
| ① 云端 7×24 / ② Main Bot 三挡权限代批 / ③ 多人角色 SOP | 单人项目；高风险动作（合主线 = 部署生产）本来就一直留给人工拍板 | **不适用** |
| ③ 五层标准里的「交付物契约」 | `crates/recommend/src/contract.rs` 的 Rust↔TS 契约测试就是雏形 | **已有雏形**，保持即可，不必上平台化 SOP |

**本轮实际改动**：`justfile`（新增 `ci-local`）、`AGENTS.md`（新会话入口 + 两条硬规则）、`CLAUDE.md`（命令表 + 「本地全绿 ≠ CI 绿」坑）、本清单 §0 / §1 / §6.9、`DEVLOG.md`、工作日志。**没动任何产品代码、没动 CI 配置、没合 PR。**

**明确没做（不是漏了）**：§6.8 表里 7 项代码优化、每周定时巡检 workflow、主网化立项 —— 都等「5 人试用」有结果再排期。

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
