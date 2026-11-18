# Roselet 项目盘点与团队检查清单

> 生成日期：2026-11-14；**§0 / §1 已于 2026-11-17 更新为新会话入口（一页纸现场快照）**。
> 依据：一次全仓只读盘点（功能完成度 / 代码质量 / CI 与生产就绪 / Web3 主网专项四路检查）+ 项目文档原文。所有结论带 `文件:行号`，关键数字已于生成当日复核。
> 用法：新会话先读 §0 / §1；派活按第 3 节分头检查，在 `- [ ]` 打勾，把「实际结果」填回去，不确定的写「待确认」不要猜。历史进展看 §6，细节看 `DEVLOG.md`。

---

## 0. 一句话结论（2026-11-17 更新；新会话先读这一节）

> **⚠️ 2026-11-18 12:15 最新状态以这一条为准**：用户已拍板**合并 PR #7 到 main（`e36bd4a`）**。main CI 四关 success、`Deploy Backend` success、迁移 `014` 随新镜像启动执行；Vercel 已换版，线上经真实浏览器验收为「普通版零 Web3、`/private-vault` 已上闩」，后端 `health` / `activity` 均 200。**下文 §1 / §6.8 / §7.1 / §8 里「未上线 / 待合并 / 仍是 Draft」都是合并前快照，不要据此判断现状**；执行记录见 §8.6。

**代码侧已经干净、四关 CI 全绿；现在真正缺的不是功能，是「有没有人真的会用」。**

`PRODUCT.md` 写着「当前唯一要做的事：找 5 个人试用，看他们会不会回来」，`README.md` 自评 `User validation 20%`；但最近 35 个提交几乎全在 Web3、门禁、契约测试上。**别把「工程流程做得更漂亮」当成项目进展。**

**现在最该做的三件事（都要真人，不是代码）**
1. **找 5 个真实用户试用，看会不会回来** ← 最高优先级，也是唯一能验证产品的事
2. 用真的 Phantom 扩展手点一遍上链（现有 `verify:phantom*` 跑的是注入的假钱包 + 本地 validator）
3. ~~决定是否合 PR #7~~ → **2026-11-18 已完成**：用户拍板合并，线上界面已变成「普通版零 Web3」，执行记录见 §8.6。**现在只剩第 1 项和第 2 项要做**

**2026-11-18 补 · 线上界面与产品意图不一致；「纯前端单独上线」已探明走不通**

- 线上正式版跑 main `7b53fb9`，**仍把 Aleo Vault 链接、`/private-vault` 整页钱包操作、详情页链上区块直接摆给所有访客**，正是被判定「有很大问题」的界面；门闩修复只在草稿 PR #7 里。§7 的 5 人试用用的就是这个线上版。
- **试过拆一个纯前端 PR #8，已关闭**：从干净 main 起分支、只搬门闩、并就地补齐覆盖率，Frontend / Miniprogram / Agent API 三个 CI job 全绿；但 **Backend Tests 红**，因为 main 基线自己还欠两笔账 —— `cargo fmt` 17 处不合规、`cargo deny` 的 `RUSTSEC-2026-0543` + `spin 0.9.8` yanked，而修复都在 PR #7 里。要修就得改 `crates/backend` / `Cargo.lock`，正好命中部署路径：修完合 main 照样重建后端镜像，**代价与合 #7 相同，还多出冲突**。PR #8 的门闩代码本就是 #7 的子集，关掉不丢代码，分支 `codex/member-gate-frontend-only` 保留。
- **main 基线共三处欠账**（覆盖率 / rustfmt / cargo deny），全都只在草稿分支修好过。这解释了为什么 PR #7 一直绿、而任何基于 main 的新 PR 都会红。
- **订正误判**：`deploy-backend.yml` 除 `head_branch == 'main'` 外还有 `Detect backend deployment changes` 路径过滤，只有 `Cargo.*` / `crates/backend` / `crates/recommend` / `deploy/lightsail` / `Dockerfile.backend` 等变化才 `should_deploy=true`。**纯前端改动合 main 不会重启生产后端**；「合到 main = 部署生产后端」只在 #7 这种含后端改动时成立（§6.8 结尾旧说法已订正）。
- **订正覆盖率口径**：§1 里的 `91.85 / 80.11 / 87.24 / 94.39` 是**草稿分支**的值；**main 基线原本只有 `87.32 / 84.71`**，低于 `jest.config.ts` 写死的 90 / 85 门槛。探路 PR #8 曾用 main 基线上真实行为测试补到 `90.06 / 76.09 / 85.79`（没调低门槛），这段补测留在保留分支里，日后若要再拆可直接复用。
- **又堵死两条近路（2026-11-18 再补）**：Vercel 的 PR 预览地址存在且部署成功，但**开了登录保护**（外人被踢到 `vercel.com/login`）；另起域名接现有后端也会被 `ALLOWED_ORIGINS` 跨域白名单拦掉。因此「不部署就给试用者看新界面」没有中间选项，只能合 #7 或按 §7.1 用旧界面。详见 **§8 上线前体检**（含本地生产构建 + 真实浏览器实测、合并会动到什么、回滚抓手）。

**这轮先别做**：继续堆 Web3 / 门禁 / 重构；`MembershipPanel` 拆分、付费会员权限、主网化、`chrono` 迁移都等第 1 项有结果再排期。理由与逐条对照见 §6.9。

阶段判断：内测可用、生产在跑；Web3 只到 Devnet / 本地验证闭环，主网进度 0；发布流程已有 `docs/RELEASE_PROCESS.md` 但尚未按它走完一次正式发布。

---

## 1. 现状快照（2026-11-17 实时核准）

| 项目 | 状态 | 依据 |
|---|---|---|
| 当前分支 | 主草稿 `codex/solana-mainnet-assessment`；探路分支 `codex/member-gate-frontend-only` 保留（PR #8 已关闭）。两者工作树干净（SHA 以 `git rev-parse HEAD` 为准，别照抄旧值） | `git status --short`、`git rev-parse HEAD` |
| PR #7 | **MERGED（2026-11-18 04:15 UTC）**，squash 到 `e36bd4a`；合并触发 `Deploy Backend` success。执行记录见 §8.6 | `gh pr view 7 --json state,mergedAt`；https://github.com/qiaopengjun5162/roselet/pull/7 |
| 线上版本 | **已换版**：Vercel 生产部署 `main e36bd4a`；真实浏览器验收「普通版零 Web3、私密页已上闩」，后端 health / activity 200 | §8.6、`gh api .../deployments?environment=Production` |
| PR #8 | **已关闭**（2026-11-18 探路用）：纯前端门闩在 main 基线上三个 CI job 全绿，但 Backend Tests 因 main 自身 rustfmt / cargo deny 欠账而红；结论改为直接合 #7 | `gh pr view 8 --json state`；https://github.com/qiaopengjun5162/roselet/pull/8 |
| 上线前体检 | **§8**：预览地址被 Vercel 登录保护、外部域名被 CORS 白名单拦；本地生产构建 + 真实 Chromium 实测「普通版零 Web3 / 会员版可逆」；PR #7 仍是 Draft，合并前需 `gh pr ready 7` | §8；`gh pr view 7 --json isDraft` |
| 分支与 main 差距 | 草稿核准时约 35 个 commit / 78 文件 / +9352 −455，全部未合主线（会随提交变化，用右侧命令现查） | `git rev-list --left-right --count origin/main...HEAD`、`git diff --shortstat origin/main...HEAD` |
| CI | 草稿最近四关全绿 `44224512958`；探路 PR #8 的 run `44230925065` 为 `failure`（仅 Backend Tests，其余三关 success） | `gh run view <run> --json conclusion,jobs` |
| 生产部署 | `Deploy Backend` 为 `skipped`（分支非 main）。**另**：合 main 是否真部署还要过 `should_deploy` 路径过滤，纯前端 PR 不会部署；PR #7 含后端路径，合它会真部署 | `.github/workflows/deploy-backend.yml` 的 `Detect backend deployment changes` |
| Web 测试 | 草稿全量 44 套件 / 326 例全过；探路分支在 main 基线上 35 套件 / 243 例全过 | 本地全量运行 + CI |
| 覆盖率 / fmt / deny | **草稿** 91.85 / 80.11 / 87.24 / 94.39 四项全过、fmt 与 deny 均绿；**main 基线三处欠账**：覆盖率 87.32 / 84.71、rustfmt 17 处、`cargo deny` 失败。探路分支曾把覆盖率补到 90.06 / 76.09 / 85.79（保留分支里可复用） | `apps/web/jest.config.ts`、`coverage-final.json`、`deny.toml` |
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
| D1 | 双份兜底收敛（**第一步已完成，见 §6.3**；结论已修订，见 §6.2） | Web 与小程序各有一套降级兜底（颜色文案 / tips / 音频策略 / 请求体），容易漂移；已因此出过 Memo 程序 ID 不一致的真实生产 bug。**已装网**：4 个 Rust↔TS 契约测试锁住颜色三元组、未知颜色兜底、tips 文案，并抓到且修复了未知颜色 `🌸`↔`🌹` 的真实漂移。**已完成（见 §6.5 / §6.7）**：兜底数据与纯函数已收敛到 `@roselet/core`，Web 与小程序都从共享包取，UI 层颜色表也一并收口；本行「仍待做」是 11-14 盘点当时的状态，不要再当待办。注意这些是「WASM 不可用」时的兜底，不能简单搬进 WASM | `AGENTS.md`「必须遵守」第 2-4 条；`crates/recommend/src/contract.rs`；`apps/web/src/lib/recommend.ts:50-61,96-100,121-124,151-157`；`apps/miniprogram/src/utils/wasm.ts:46-69,105-114`；`DEVLOG.md` Memo 修复记录 |
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

**结论：§6.2 / §6.3 / §6.5 / §6.6 / §6.7 的代码侧盘点项全部闭环，工作树干净、分支与远端一致。** 剩下的是需要真人 / 决策的事项，按建议顺序：① 找 5 个真实用户试用（`PRODUCT.md:74` 写「当前唯一要做的事」）；② 真 Phantom 扩展人工手测（现有 `verify:phantom*` 是注入 fake wallet + 本地 validator 的 E2E，真扩展签名尚未人验）；③ 合 PR #7 —— 它**含后端路径改动**（`crates/backend` / `Cargo.lock` 等），合到 main 会让 `deploy-backend.yml` 判定 `should_deploy=true`，确实会重启生产后端，属**不可逆的外部动作**，需明确拍板；④ 主网化单独立项。

**2026-11-18 订正**：上面旧版只写了 `head_branch == 'main'`，容易读成「任何合 main 都等于部署后端」。实际 workflow 还有一层 `Detect backend deployment changes` 路径过滤，纯前端改动 `should_deploy=false`、部署步骤全跳过。另外「普通界面零 Web3」的修复虽已写进 §6.8，但**只在草稿分支，线上正式版 main 尚未生效**；单独拆纯前端 PR 上线的尝试（PR #8）已探明走不通并关闭，结论改为直接合 #7，见 §0 与 §7.1。

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

## 7. 五人试用操作卡（2026-11-18，可直接转发）

> 这一节是给「帮忙找人试用的组织者」和「试用者」看的，通篇不用技术词。
> 目标来自 `PRODUCT.md:74`：**找 5 个人试用，看他们会不会回来**。
> 把 §7.3 原样转发给试用者即可；组织者先看 §7.1。

### 7.1 前提（组织者先看，别漏）

- **试用入口只有一个**：https://roselet-web.vercel.app （手机浏览器直接打开，不用装东西）。
- **现在线上跑的是 2026-11-18 合并后的新版本**（PR #7 已合到 main）。「会员版 / 把 Web3 入口收起来」**已经上线**；不要拿旧截图或草稿分支的说明发给试用者，一切以他们实际打开的页面为准。
- **界面前提（2026-11-18 合并后订正）**：试用者看到的就是**目标界面**——首页没有「使用 Aleo 私密 Vault」，直接打开 `/private-vault` 也只会看到「只在会员版开放」。右上角仍留着「🌐 会员版」入口，但那不是本轮要验证的东西，**不要向试用者解释、不要引导他们点**；如果一周后的三个问题里有人主动提到，把原话记下来即可。
- **别发预览链接**：Vercel 为该草稿生成的 Preview 地址需要 Vercel 账号登录才能打开，试用者进不去；也不能另找一个临时域名顶替（后端跨域白名单一拦，种花就失败）。**发给试用者的只能是 https://roselet-web.vercel.app**，理由与实测见 §8.1。
- 小程序的微信登录和真机联调还没做完（`PROGRESS.md:310-311`），这一轮**不走小程序**。
- 试用者可能写下真实情绪：别截图外传、别公开讨论谁写了什么；公开还是私密由试用者自己选。信任是前提（`PRODUCT.md:79`）。

### 7.2 找谁

- **5 个真实用户**：不参与开发、不是同事、事先没被讲过产品规则。
- 尽量分散：不同年龄、不同手机使用习惯；至少 2 位平时完全不碰 Web3 / 链上应用。
- **一个一个单独来，别拉群集体试用**，避免互相模仿或客气夸奖。

### 7.3 给试用者（以下可原样转发）

> 有个小应用想请你帮个忙，大概 5 分钟，一个人安静做就行。
>
> 打开：https://roselet-web.vercel.app
>
> 1. 随便点进去看看，不用先了解规则。
> 2. 看到「种一朵玫瑰」就点，选一个颜色，把想写的写下来（三栏随便填，只填一栏也行，不想写可以不写）。
> 3. 种下去之后就结束，不用做别的。
> 4. **接下来 7 天不用提醒、不用打卡**：哪天你自己又想打开它，就再去种一朵；不想打开就完全不用管。
> 5. 一周后我会问你三个小问题。
>
> 不用填真实姓名，起个昵称就行；写的内容只有你自己，以及（如果你选公开）花圃里的人能看到。

### 7.4 一周后只问这三个（别问「好不好用」）

1. 这一周里，你自己又打开过它吗？大概几次？是什么时候、因为什么？ ← **最重要**
2. 种完那一下，你是什么感觉？用一两个你自己的词说就行。
3. 有没有哪一步让你卡住、犹豫、或者不想继续？在哪一页？

组织者**只记原话**：不解释规则、不辩解、不补提示、不引导。对方说「没打开」也是有效答案，而且比客气的夸奖有用得多。

### 7.5 结果记录表（复制去填）

| 编号 | 怎么找来的 | 首次是否种完 | 7 天内自己回来过吗 | 回来几次 | 原话（感觉 / 卡点） |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

### 7.6 什么算验证通过（先把标准定死，别事后找理由）

| 结果 | 判定 |
|---|---|
| **通过** | 5 人里 ≥3 人在**没人提醒**的情况下，7 天内自己回来再种过一次，且没人卡在种花这一步 |
| **没通过** | ≤2 人回来，或有人没能走完流程 |
| **还不确定** | 多数人说「想用但没想起来」——这是提醒机制的问题，不是「用户不认可」，单独记一笔 |

- 判据依据 `PRODUCT.md:20`（成功是「种花后感到轻盈」）和 `:74`（「看他们会不会回来」）。
- **不要**拿点赞数、访问量、注册数当指标——`PRODUCT.md` 明确排除这类攀比信号。
- 不管哪种结果，**先别接着加功能**：把 5 份原话整理成一页结论，再决定下一步。

### 7.7 谁来做 / 结果放哪

- **组织者必须是真人**：找人、转发、观察、收原话，AI 代替不了。
- 结果写进本节末尾或 `DEVLOG.md`，并把 §1 的「用户验证」从 0 改成实际完成数。
- 这一步没做完之前，§6.8 的代码优化、主网化、付费会员权限、合 PR #7 **都不排期**。

---

## 8. 合 PR #7 上线前体检（2026-11-18 实证）

> 回答两个问题：合了之后用户到底看到什么？合这一步会动到什么、出事怎么退？
> **结论：合 PR #7 是让线上界面变对的唯一可行路径**；另外两条「不动生产也能换界面」的近路已实测堵死，见 §8.1。

### 8.1 两条近路实测都不通（所以别再找「不部署也能试用新界面」的办法）

| 近路 | 实测结果 | 依据 |
|---|---|---|
| 把 Vercel 的 PR 预览地址发给试用者 | 预览确实存在且部署成功（deployment `7873534643`，`state=success`，URL `https://roselet-rae0irin3-qiaopengjuns-projects.vercel.app`），但打开会被 302 踢到 `vercel.com/sso-api` → 登录页：**这个预览开了 Vercel 登录保护，外人进不去** | `gh api repos/qiaopengjun5162/roselet/deployments/<sha>/statuses`；`curl -I` 的 `location` 响应头 |
| 另起一个对外前端域名，让它连现在的生产后端 | 生产后端用 `ALLOWED_ORIGINS` 白名单（`crates/backend/src/lib.rs:27-33`、`config.rs:47`）。用陌生域名发 `OPTIONS` 预检，返回 200 但**没有 `access-control-allow-origin`** → 浏览器会拦掉所有种花请求，试用直接失败 | 实测 `OPTIONS https://roselet.47.131.238.0.sslip.io/api/rose`；白名单值见 `docs/AWS_LIGHTSAIL_DEPLOYMENT.md:361` |

也就是说：要么合 #7，要么试用继续用旧界面（§7.1）。**没有「不部署也能换界面」的中间选项**。顺带确认线上正式版首页确实仍有 `Aleo` / `Vault` / `private-vault` 字样，与 §0 的判断一致。

### 8.2 合上去之后用户看到什么（本地生产构建 + 真实 Chromium 实测）

在草稿分支 `28d14ec` 上跑 `next build`（14 页全部生成）→ `next start` → Playwright Chromium 真点一遍：

| 场景 | 实测结果 |
|---|---|
| 普通模式首页 / 种花页 / 详情页 | 可见 Web3 入口 **0** |
| 直接输 `/private-vault` | 只显示「Aleo 私密 Vault 只在会员版开放」；可点按钮仅 `🌐 会员版 / 🔇 / 切换到会员版`，**钱包按钮 0** |
| 点右上角「🌐 会员版」 | 会员状态条出现、Aleo 入口出现、`aria-pressed=true`、上链面板弹出 |
| 返回普通版 | 两条路径都验过：① 弹层内「退出会员模式」；②「✕ 收起面板 → 状态条『返回普通版』」。两条都能让 Web3 入口归零 |

**一个不影响使用、但值得记的小瑕疵**：上链面板打开时，深色遮罩（`z-[60]`）盖住状态条（`z-40`），状态条上的「返回普通版」此时点不到；弹层里自带「退出会员模式（回到普通界面）」，所以用户仍能退出。列为待打磨项，不阻断上线。

### 8.3 合这一步会动到什么（按时间顺序，大白话）

1. CI 四个 job 重跑一次（草稿分支最近 `44231425251` 四关全绿；合到 main 后会再跑一次）。
2. `Deploy Backend` 被 `workflow_run` 触发；`should_deploy` 看到 `Cargo.lock` / `crates/backend/**` / `migrations/014...` 变化 → `true`。
3. 构建并推送 `ghcr.io/.../roselet-backend:<sha>` 镜像，Lightsail 拉新镜像 `docker compose up -d db backend`。脚本先把旧镜像名写进 `.previous_backend_image`（`scripts/lightsail-deploy.sh:31`），**出事可退回旧镜像**。
4. 后端进程启动时执行 `sqlx::migrate!("./migrations").run(&pool)`（`crates/backend/src/main.rs:16`），自动跑新迁移 `014_create_solana_nft_mints.sql`：只是 `CREATE TABLE` + `CREATE INDEX`，**不改已有表、不动已有数据**（新增的 NFT 上链记录表，会员版才用得到）。
5. Vercel 自动部署前端，线上界面变成「普通版零 Web3」。

**合并前的小动作（已执行）**：体检时 PR #7 仍是 **Draft**，合并前先执行 `gh pr ready 7`，再用 `gh pr merge 7 --squash` 合并。

### 8.4 合完之后三个 10 秒检查

1. 打开 https://roselet-web.vercel.app → 首页不该出现「Aleo / Vault / 连接钱包」。
2. 直接打开 https://roselet-web.vercel.app/private-vault → 只看到「只在会员版开放」。
3. `curl https://roselet.47.131.238.0.sslip.io/health` 返回 200，且 `gh run list --limit 2` 里 CI 与 Deploy Backend 都 success。异常时以 `.previous_backend_image` 为回滚抓手。

### 8.5 边界

体检阶段只做**只读探测 + 本地验证 + 文档**：没有合并任何 PR、没有改生产配置、没有动后端代码、没有加新门禁。实证截图（普通首页 / 会员版）仅在本次会话留证，未入库。**用户拍板后已执行合并，见 §8.6。**

### 8.6 执行结果（2026-11-18 04:15–04:30 UTC）

| 时间线 | 结果 |
|---|---|
| `gh pr ready 7` → `gh pr merge 7 --squash` | PR #7 **MERGED**，main 到 `e36bd4a`（04:15:21 UTC）；等待最后一个 Pending job 转绿后才合，合并前四关全 `success` |
| main CI `44236051431` | 四 job 全 `success` |
| `Deploy Backend` `44236874463` | **success**；日志 `Backend deployment files changed: deploying backend.`，命中 `crates/backend/migrations/014_create_solana_nft_mints.sql`；镜像构建推送、Lightsail `docker compose up -d`、`Container roselet-db-1 Healthy` 均正常 |
| Vercel 生产部署 | `main e36bd4a` 部署完成，前端换版 |
| §8.4 三项检查 | ① 线上首页真实浏览器**可见 Web3 入口 0**（HTML 源码里仍有 1 处 Aleo 字符串，是 Next 把隐藏子组件序列化进 RSC 数据，不可见，属预期）；② `/private-vault` 显示「只在会员版开放」、钱包按钮 0；③ `health=200`、`activity=200`，CI 与 Deploy Backend 双 success |

**现在可以开始 5 人试用了**：试用入口仍是 https://roselet-web.vercel.app ，直接转发 §7.3 操作卡即可；§7.1 的界面前提已按新版本订正。剩余真人事项：找 5 人试用（最高优先级）、真 Phantom 扩展手测。

**回滚抓手**：`scripts/lightsail-deploy.sh:31` 写下的 `.previous_backend_image`；本次无需使用。

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
