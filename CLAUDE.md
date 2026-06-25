# CLAUDE.md - Roselet

> **新会话开始时，先读 `DEVLOG.md` 了解上次进度。**

## 项目简介
Roselet 是一个社区破冰互动 Web 应用：用户种下玫瑰（感恩）、花苞（期待）、尖刺（焦虑），形成社区花圃。

## 技术栈
- 后端：Rust + Axum + SQLx + PostgreSQL（端口 3001）
- 前端：Next.js 16 + shadcn UI + pnpm + Tone.js（端口 3000）
- 小程序：Taro 4 + React 18 + TypeScript + WXWebAssembly
- 数据库：PostgreSQL（本地 roselet 数据库）
- AI：OpenAI 兼容 API（异步生成个性化回复）
- WASM：Rust → wasm-bindgen（客户端智能推荐 + 情绪分析）
- 部署：Docker Compose（一键启动）

## 项目结构
```
roselet/
├── apps/web/           # Next.js 前端
├── apps/miniprogram/      # Taro 微信小程序
├── packages/core/         # 共享 TypeScript 类型
├── crates/backend/     # Rust Axum 后端
├── crates/recommend/   # Rust WASM 推荐模块
├── Cargo.toml          # Rust workspace
└── package.json        # pnpm workspace
```

## 架构原则（最高优先级）

**90/10 Rust-TS 架构**：Rust WASM 承载全部业务逻辑，TS 退化为纯平台调用层 + UI 渲染壳。

**铁律（违反即错误）：**
- **Rust WASM 拥有（`crates/recommend/src/`）**：业务算法、数据校验、状态机、颜色元数据、音频参数映射、情绪分析、花瓣轨迹、天空时段、粒子生成、日期格式化、花圃布局、表单验证、推荐引擎、敏感词检测、字符串处理
- **TS 仅拥有**：`fetch()` / `localStorage`、Web Audio API / Tone.js 扬声器、Taro API / wx.request、React/Taro 组件渲染、Tailwind CSS 样式
- **判断标准**：凡是可以写 Rust 单元测试的逻辑，一律不留在 TS 里。新增功能必须先问"这个逻辑能不能放进 `crates/recommend/src/`？"
- **TS 文件里的 `if/switch/for/while` 必须能解释为什么不能是 Rust WASM 调用**
- **多语言原则**：当前默认中文，暂不产品化完整中英文切换；若启动 i18n，跨端文案、日期、颜色、情绪、花语、主题推荐、AI prompt 等可测试本地化逻辑优先放 Rust WASM，策略见 `docs/I18N_STRATEGY.md`

认证：双令牌 (Access 15min + Refresh 30天，DB 存 SHA-256 哈希)，令牌桶限流 30req/60s。
Web + 小程序：401 → 静默刷新（Promise 复用锁防并发）→ 原请求重试。
账号注销：软删除 + 30 天冷却期；冷却期内同昵称登录恢复原账号，过期后旧账号昵称匿名化并释放。

## 测试状态
```
Rust backend:   110 passed
Rust WASM:      139 passed
Web frontend:   146 passed
Miniprogram:     66 passed
Total:          461 passed

llvm-cov (workspace): 90.37% 行覆盖 / 88.41% region
  100%: flowers, petal, sky, keywords, pagination, user, docs, state
  99%+: garden (99.61%)
  97%+: audio (97.87%), api_client (98.15%)
  96%+: color (96.39%), fireworks (96.30%)
  90%+: plant (93.06%), emotion (91.43%), store (90.21%), rose routes (94.87%)

Jest coverage:
  Web: 91.32% statements / 96.48% lines
  Miniprogram: 99.33% statements / 100% lines / 96.05% branches
Coverage gates:
  pnpm test:coverage  # Web + Miniprogram coverage threshold
Quality gates:
  pnpm typecheck      # Web + Miniprogram tsc
  pnpm lint           # Web ESLint
  cargo deny check    # Rust dependency audit
  cd apps/web && pnpm build  # Next production build
  cd apps/miniprogram && pnpm build:weapp  # Taro production build
```

## WASM 模块清单（crates/recommend/src/）
| 模块 | 功能 | WASM 导出 |
|------|------|----------|
| `emotion.rs` | 文本→情绪→音频参数 | `analyze_text` |
| `audio.rs` | 玫瑰属性→示波器参数 + 音频互斥策略 | `rose_to_sound_params_wasm`, `audio_playback_policy_wasm` |
| `color.rs` | 颜色元数据（emoji/label） | `color_emoji`, `color_label`, `color_options` |
| `petal.rs` | 确定性花瓣轨迹（seed） | `generate_petals_wasm` |
| `datefmt.rs` | 日期格式化（中文） | `format_date_wasm` |
| `garden.rs` | 花圃布局 + 过滤 | `compute_layout`, `filter_roses` |
| `plant.rs` | 种花表单校验 | `validate_plant_input`, `format_plant_request_wasm` |
| `store.rs` | 全局状态机 | `store_dispatch`, `store_get_snapshot` |
| `api_client.rs` | URL/请求体构造 | `build_garden_url`, `build_plant_body` |
| `fireworks.rs` | 烟花粒子生成（seed RNG） | `burstFireworks`, `getFireworkLaunches` |
| `offline.rs` | 乐观更新 + 花圃缓存合并 | `build_optimistic_rose_wasm`, `apply_garden_cache_action_wasm` |

## 已知坑（勿重踩）
- **reqwest 测试 502**：本地开启 Clash 代理时，加 `NO_PROXY=localhost,127.0.0.1`
- **wasm-opt bulk-memory**：Cargo.toml 设 `wasm-opt = false`
- **小程序 document.baseURI**：Webpack BannerPlugin 注入 document mock（非运行时 polyfill）
- **小程序 typecheck 依赖 WASM pkg**：`src/utils/wasm.ts` / `useWasmStore.ts` 动态 import `../../pkg/roselet_recommend`；CI 干净 checkout 时必须先 `wasm-pack build --out-dir ../../apps/miniprogram/pkg` + `node scripts/patch-wasm.js`，再跑 `pnpm --filter @roselet/miniprogram typecheck`
- **小程序离线花圃缓存**：wx storage 只保存公共花圃快照；`set/optimistic_create/confirm_create/reject_create` 必须经 `offline.rs` 的 `apply_garden_cache_action_wasm`，不要在 TS 复制合并规则
- **小程序预构建 JSON 请求体**：`createRose()` 使用 Rust `build_plant_body` 的 JSON 字符串；`request.ts` 必须识别字符串 body 并原样传给 `wx.request`，避免二次 JSON 编码
- **wasm-bindgen Option<&str>**：改用 `&str`，空字符串表示 None
- **后端集成测试共享 DB**：`create_test_app()` 必须 `TRUNCATE feedbacks, refresh_tokens, likes, roses, users RESTART IDENTITY CASCADE`；nextest 用 `-j1` 避免并发清库互踩
- **Next 构建不依赖 Google Fonts**：避免 `next/font/google` 在受限网络里拖垮 build；全局字体走系统中文字体栈
- **pnpm 沙箱 fetch failed**：Codex 沙箱内 `pnpm exec` / `pnpm test:*` 可能触发 `[ERROR] fetch failed`；优先用已安装依赖重跑，必要时按审批走外部执行
- **cargo deny advisory DB**：沙箱内可能因 `~/.cargo` 只读或网络失败不能更新 advisory DB；本地用 `https_proxy=http://127.0.0.1:7890 cargo deny check`
- **虚拟 Cargo workspace clippy**：根目录没有 default-members 时，质量门禁显式跑 `cargo clippy --workspace --all-targets --all-features --tests --benches -- -D warnings`
- **后端 nextest 本地 DB**：沙箱内可能因本地数据库连接 `Operation not permitted` 失败；用 `NO_PROXY=localhost,127.0.0.1 cargo nextest run --workspace --all-features --no-fail-fast`
- **托管 Postgres TLS**：Neon / Render Postgres 需要 `sqlx` 启用 `runtime-tokio-rustls`，只开 `runtime-tokio` 会在编译期 SQLx 宏连接和运行期连库时报 “TLS upgrade required”
- **Jest 生成物冲突**：`next build` / Playwright / WASM 会生成重复 package metadata；`apps/web/jest.config.ts` 必须忽略 `.next`、`playwright/.cache`、`public/wasm`
- **小程序云测**：必须上传体验版或线上版，开发者/管理员身份进入；本地 Jest 仍是提交前门禁，云测用于真机兼容、黑白屏、性能和 JsError 验收
- **AIMonkey**：云测 AI Monkey 会生成可回放 Minium 代码；不支持智能化 Monkey 的前置步骤，固定账号状态优先用测试账号或 Minium 自定义用例
- **AI 自定义测试**：适合把明确业务路径写成自然语言用例；成功结果仍需人工核对报告截图和生成的 Minium 代码，再沉淀为确定性回归
- **认证状态码语义**：缺 token / token 过期 / token 无效返回 401，让前端触发静默刷新；已认证但 owner 不匹配才返回 403/404
- **账号软删除**：所有需要登录身份的后端路由都必须校验 `users.deleted_at IS NULL`；否则旧 access token 在 15 分钟有效期内会继续操作已注销账号
- **注销撤销 token**：Web 端 `/api/auth/logout` 发送的是 refresh token，后端不能只按 access token 解析，必须支持按 refresh token 哈希撤销
- **i18n 不要前端分叉**：当前不做完整双语；后续若加中英文，先加 Rust `Locale` 和 WASM 本地化表，再让 Web / 小程序读取同一套结果
- **git push**：必须用 `https_proxy=http://127.0.0.1:7890 git push`
- **Worker 最小测试**：`apps/worker-api` 当前把 Worker 编译和 Node 测试分开；先跑 `pnpm worker:typecheck`，再跑 `pnpm worker:test`
- **Worker NodeNext 导入**：`apps/worker-api` 内部相对导入在可复用模块里显式写 `.js` 扩展名，避免 NodeNext 编译失败
- **当前生产后端**：AWS Lightsail `https://roselet.47.131.238.0.sslip.io`，Caddy 监听 `443/80` 反代到 Rust Axum `3001`，`http://47.131.238.0` 只用于 IP 冒烟，操作记录见 `docs/AWS_LIGHTSAIL_DEPLOYMENT.md`
- **Vercel API 基址**：生产前端必须配置 HTTPS：`NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_AUTH_API_URL` / `NEXT_PUBLIC_READ_API_URL=https://roselet.47.131.238.0.sslip.io`，`NEXT_PUBLIC_WS_URL=wss://roselet.47.131.238.0.sslip.io`
- **Stats 后台**：Rust `/api/stats` 需要 JWT + `ADMIN_USER_IDS` 白名单；生产服务器 `.env.production` 必须配置管理员 user id
- **生产密钥**：Lightsail `.env.production` 只留在服务器，不能把 `POSTGRES_PASSWORD` / `JWT_SECRET` / 私钥写入 Git 或文档
- **Lightsail Compose 项目名**：自动部署必须固定 `COMPOSE_PROJECT_NAME=roselet`，复用 `roselet_pgdata`；否则会生成 `lightsail_*` 容器/卷并和旧后端抢占 `3001`
- **Lightsail 环境变量变更**：只改服务器 `.env.production` 后，`docker compose restart backend` 不会把新值注入现有容器；必须结合 `~/roselet/.current_backend_image` 对 backend 执行 `up -d --force-recreate`
- **前景音频互斥**：听一朵玫瑰 / 示波器试听前必须调用 Web `prepareForegroundAudio()`；是否停掉导航栏背景音乐由 Rust WASM `audio_playback_policy_wasm` 决定，短音效不打断背景音乐

## 常用命令（justfile）
```bash
just dev              # 启动完整开发环境（后端 3001 + 前端 3000）
just build            # 编译后端
just test             # 运行所有测试
just check-all        # 完整检查（格式 + lint + 审计 + 测试）
just pre-commit       # 提交前检查（格式化 + lint + 测试）
just db-init          # 数据库初始化（创建 + 迁移）
just db-reset         # 数据库重置
just migrate          # 运行数据库迁移
just fmt              # 格式化代码
just clippy           # clippy lint
just typecheck        # Web + 小程序 TypeScript 类型检查
just lint             # Web ESLint 检查
just coverage         # Web + 小程序覆盖率门禁
just audit            # 依赖审计
just next-build       # Web Next 生产构建
just worker-typecheck # Cloudflare Worker API 类型检查
just worker-test      # Cloudflare Worker API 最小行为验证
just worker-dev       # Cloudflare Worker API 本地开发
just changelog        # 生成 CHANGELOG
just wasm              # 构建 WASM 推荐模块
just wasm-mini         # 为小程序构建 WASM（编译 + WXWebAssembly 补丁）
just miniprogram       # 小程序开发模式
just miniprogram-build # 小程序生产构建
```

## API
```
POST   /api/auth/register  # 用户注册 → 201, 返回 access_token(15min) + refresh_token(30d)
POST   /api/auth/refresh   # 刷新 Access Token
POST   /api/auth/logout    # 注销（撤销 Refresh Token）
POST   /api/auth/deactivate # 注销账号（软删除 + 30 天冷却期）
GET    /health             # 健康检查（数据库连接 + 版本信息）
POST   /api/rose           # 种一朵玫瑰（后台异步生成 AI 回复）→ 201 Created
PUT    /api/rose/:id       # 编辑玫瑰（仅 owner）
DELETE /api/rose/:id       # 删除玫瑰（仅 owner）
GET    /api/garden         # 获取花圃（分页，可选 ?color=red/white/yellow）
GET    /api/rose/:id       # 获取单朵玫瑰
GET    /api/my/roses       # 获取个人花圃（需 JWT，分页）
GET    /api/user/profile   # 获取用户资料 + 种花统计（需 JWT）
POST   /api/rose/:id/like  # 点赞/取消点赞（需 JWT）
GET    /api/ws             # WebSocket 实时推送
GET    /swagger            # Swagger API 文档
GET    /api/openapi.json   # OpenAPI 3.0 规范 JSON
POST   /api/feedback       # 提交反馈（可选 JWT，匿名/登录均可）
```

## 开发工具链
| 工具 | 用途 |
|------|------|
| rustfmt | Rust 格式化 |
| taplo | TOML 格式化 |
| clippy | 静态分析 |
| cargo-deny | 依赖审计（许可证、漏洞） |
| typos | 拼写检查 |
| cargo-nextest | 测试运行器 |
| git-cliff | CHANGELOG 生成 |
| .pre-commit-config.yaml | Git hooks |

## Rust Dev Workflow 经验库
- 经验总结文档：`docs/RUST_DEV_WORKFLOW_EXPERIENCE.md`
- 多语言策略文档：`docs/I18N_STRATEGY.md`
- 新问题处理顺序：先修复 → `DEVLOG.md` 记录问题/根因/解决/验证 → 可复用经验提炼进经验库 → 必要时同步 `AGENTS.md` / `CLAUDE.md` / `PROGRESS.md` → commit + push
- 能跨项目复用的经验，后续再升级到通用 `rust-dev-workflow` skill 或模板配置。

## 开发规范
- 每次修改都要 commit 和 push（Conventional Commits）
- 测试运行器：cargo-nextest（不是 cargo test）
- 测试覆盖率尽可能 100%
- 代码模块化，附必要注释
- 遇到问题先解决，并在 `DEVLOG.md` 记录问题、原因、处理方式、验证命令；可复用经验同步到 `docs/RUST_DEV_WORKFLOW_EXPERIENCE.md`
- 及时更新文档（PROGRESS.md、CLAUDE.md；Codex 入口变更同步 AGENTS.md）
