# AGENTS.md - Roselet

> 新会话开始时，**先读 `docs/TEAM_REVIEW_CHECKLIST.md` 的 §0 / §1**（一页纸现场快照：现在到哪了、卡在哪、最该做什么、先别做什么），再按需查 `DEVLOG.md`（5000+ 行）看细节。不要把长日志当入口，也不要凭记忆判断项目进度。

这是 Codex 的项目入口文件。完整项目规则、架构约束、命令速查和测试状态以 `CLAUDE.md` 为共享源，避免两份长文档重复维护后漂移。

## 必须遵守
- 业务逻辑优先放进 `crates/recommend/src/` 的 Rust WASM 层；TS 只保留平台调用和 UI 渲染。
- 跨端文案、本地化业务映射、日期/颜色/情绪/花语/AI prompt 等可测试 i18n 逻辑优先放 Rust WASM；不要让 Web 和小程序各维护一套。
- 音频策略也属于 Rust WASM：听一朵玫瑰 / 示波器试听等前景音频启动前，Web 只能调用统一 `prepareForegroundAudio()`，不要在组件里散落背景音乐开关判断。
- 乐观更新、缓存合并、状态冲突处理属于 Rust WASM；IndexedDB / wx storage 只负责平台持久化。
- 小程序 `createRose()` 发送 Rust `build_plant_body` 产出的 JSON 字符串；`request.ts` 必须原样传字符串 body，不能二次 `JSON.stringify`。
- 玫瑰种下后的正文内容不可修改，也暂不提供删除入口；`PUT /api/rose/{id}` 只做 owner 设置更新，目前仅允许公开转私密，或为「公开且未送礼」的玫瑰补填 `recipient_nickname` 完成送礼。
- 账号注销使用软删除：`deleted_at` 冷却 30 天内允许原昵称恢复；超过 30 天先匿名化旧账号再释放昵称，不能直接硬删用户和玫瑰。
- Web `logout()` 用 refresh token 调 `/api/auth/logout`；后端必须支持按 refresh token 撤销，不能只接受 access token。
- 如果目标是 `不绑卡上线`，后端迁移入口固定在 `apps/worker-api/`；不要再把 Render / Koyeb 当作默认免费后端方案。
- 当前实际生产后端路线已切到 AWS Lightsail：`https://roselet.47.131.238.0.sslip.io` 由 Caddy 反代到 Rust Axum `:3001`，`http://47.131.238.0` 只用于 IP 冒烟，操作手册见 `docs/AWS_LIGHTSAIL_DEPLOYMENT.md`。
- Vercel 生产前端必须使用 HTTPS API 基址和 `wss://` WebSocket，不能再配置 `http://47.131.238.0`，否则浏览器 mixed content 会拦截请求。
- Cloudflare Pages 国内镜像若保留 `public/_worker.js` fallback，必须同时提交 `apps/web/public/_routes.json`，把 Functions 调用范围限制到 `/rose/*`；不要让全站静态请求都先经过 Worker，否则会快速耗尽免费 daily requests。
- Rust `/api/stats` 是管理员后台接口，生产必须在 Lightsail `.env.production` 配置 `ADMIN_USER_IDS`，不要把统计后台公开给所有登录用户。
- Lightsail 服务器上的 `.env.production`、数据库密码、JWT_SECRET、私钥不能写入 Git；文档只记录命令模板和公开地址。
- Lightsail 的 Caddy 反代配置以 `deploy/lightsail/Caddyfile` 为仓库内共享源；生产如果只在服务器上手改 `/etc/caddy/Caddyfile` 而不回写仓库，后续排障和重装会漂移。
- 已发布并执行过的 `crates/backend/migrations/*.sql` 只能追加新文件，不能改旧文件内容，哪怕只改注释；`sqlx` 会校验 checksum，生产启动会直接报 `VersionMismatch(n)`。
- Lightsail 自动部署必须固定 Docker Compose project name 为 `roselet`，复用 `roselet_pgdata`；不要让 `deploy/lightsail/docker-compose.backend.yml` 默认生成 `lightsail_*` 容器和卷。
- `Deploy Backend` 只应在后端镜像相关路径变化或手动触发时部署；文档、Web、小程序变更不应重启生产 Rust 后端。
- 生产发布按 `docs/RELEASE_PROCESS.md` 执行；功能开发先走分支/预览/冒烟，不要把日常优化直接当作生产发布。
- 用户可见版本号以 Git tag / GitHub Release 为准，关于页展示的版本、commit、构建时间必须能追溯到发布记录。
- Base Sepolia 链上纪念版只能为公开玫瑰创建；前后端的 `ROSE_MEMORIAL_CONTRACT_ADDRESS` / `NEXT_PUBLIC_ROSE_MEMORIAL_CONTRACT_ADDRESS` 必须是同一地址，后端只信任 RPC 回执内匹配合约、玫瑰编号、钱包、短句哈希和颜色的 `RoseMemorialMinted` 事件，绝不接触用户钱包私钥。
- Aleo 私密 Vault 的原文、本地 AI 回应和分享 nonce 只能进入浏览器 Rust WASM；钱包交易只接收 WASM 生成的四个 `field`，不能把原文发给 Roselet 后端、公开 mapping 或 Leo program input。Leo record owner 固定使用 `self.signer`，不能改成可能为程序地址的 `self.caller`。
- Solana Agent API 固定使用 x402 v2 SVM `exact` + Devnet USDC；`X402_SVM_PAY_TO` 只能是公开收款地址，服务端不得持有付款方或商户私钥。推荐和校验继续复用 `crates/recommend` 的 Node WASM；Rust 变更后必须运行 `just agent-wasm` 更新 `apps/agent-api/pkg`。
- 已归档的是旧 `goat-sdk/goat`，不能作为新增核心运行时依赖；官方 `GOATNetwork/x402` 仍在维护。GOAT 支付使用其 `goatflow-sdk-server` 的 `DIRECT` 商户订单接口，API key/secret 只能留在 Agent API 服务端；Solana 标准 x402/SVM 路径继续独立保留。
- GOAT 订单必须与 Rust WASM 规范化后的 reflection 和付款字段做 domain-separated 绑定；只有订单状态为 `INVOICED`、订单字段匹配且 proof 获取并校验通过后才能生成推荐，不能把 `PAYMENT_CONFIRMED` 或 SDK 返回的未签名 checksum 当成最终交付证明。
- x402 SVM 客户端通过 Undici 环境代理访问 RPC 时，必须删除 Solana Kit v5 显式设置的 `Content-Length`，让 Undici 按 body 重算；否则 `EnvHttpProxyAgent` 会报 `UND_ERR_INVALID_ARG: invalid content-length header`。
- Worker 侧最小验证优先拆成独立的 `worker:typecheck` 和 `worker:test`，不要把 Cloudflare 类型环境和 Node 测试宿主强行混成一套。
- Worker 侧跨文件相对导入按 NodeNext/ESM 目标显式写 `.js` 扩展名，避免测试编译链和部署编译链分叉。
- 修改后按风险运行对应检查；Rust 测试使用 `cargo-nextest`。
- Web/小程序/Agent API 覆盖率门禁使用 `just coverage` 或根目录 `pnpm test:coverage`。
- 质量门禁使用 `just typecheck`、`just lint`、`just audit`、`just next-build`；`just check-all` / `just pre-commit` 已包含这些检查。
- **push 前跑 `just ci-local`，不要只跑 `just pre-commit`**：后者不含 Web 覆盖率门槛和小程序 `taro build --type weapp`，历史上两次造成「本地全绿 / CI 红」。CI 的四个 job 以 `just ci-local` 为本地等价。
- **试用入口是 `http://47.131.238.0`，不要改回 `*.vercel.app`**：`*.vercel.app` 在国内被 DNS 污染（三个公共 DNS 返回三个不同的境外 IP），Vercel 边缘 IP 直连也在 TLS 握手阶段失败；`sslip.io` 在国内解析不到。唯一能通的是服务器裸 IP，所以前端也跑在那台机器上（`Dockerfile.web` + compose `web` 服务 + Caddy `:80` 按 `/api` 分流）。这条由 `apps/web/src/lib/__tests__/deploy-entry.test.ts` 守住。
- **线上走查必须留一组不带代理的对照**：本机访问境外站点都要走 `127.0.0.1:7890`，这会把「国内打不开」的故障一起代理掉。`globals.css` 曾因第一行 `@import` Google Fonts 在国内白屏（30 秒一次都没画），而此前每一次真浏览器验收都带代理，所以一次都没复现。首屏相关改动至少跑一组不带 `--proxy` 的走查，或显式拦掉 `fonts.googleapis.com` 等境外域验证降级路径。
- **每次 CI 红，修复必须带一条防复发的可执行检查**（补进 `just ci-local`、加测试 / lint 规则 / 契约守卫三选一）。只改坏掉的那一行不算修完，否则同一个坑会反复踩；把根因和防复发措施一起写进 `DEVLOG.md`。
- 纸面规则不算数：`CLAUDE.md` 写了「默认零 Web3 痕迹」却漏了四处入口，直到补上门闩测试和契约守卫才真正守住。新增架构约束时同时问一句「哪条自动检查会在它再被破坏时报错」。
- 每次代码或项目文档变更都要 commit 并 push。
- 遇到问题先解决；解决后把问题、原因、处理方式、验证命令记录到 `DEVLOG.md`。
- 可复用经验沉淀到 `docs/RUST_DEV_WORKFLOW_EXPERIENCE.md`，不要只留在会话记录里。
- 发现新的非显然约束时，同时更新 `DEVLOG.md` 和共享项目文档。
