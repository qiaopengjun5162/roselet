# Roselet 开发进度

## 当前状态

- 当前阶段：`Beta 上线联调（Web 已上线，Rust 后端已上 Lightsail）`
- 项目定位：`产品内核已完成，正在把真实线上入口接到 Rust 后端`
- 更新时间：`2026-06-24`

### 总体进度（主观里程碑）

```text
总体进度        [########--] 75%
产品功能        [#########-] 90%
工程质量        [#########-] 90%
生产部署        [########--] 82%
小程序落地      [#####-----] 50%
真实用户验证    [##--------] 20%
```

## 最终目标

1. 做成一个可以公开访问、可分享、可持续演示的社区情绪花圃产品。
2. 先完成 Web 端稳定上线，再补齐小程序真机闭环。
3. 在真实用户试用后，验证产品价值，再决定是否继续做国际化和 Web3 扩展。

## 路线图

### Phase 1：产品内核完成

- 状态：`已完成`
- 目标：把 Roselet 做成一个完整可玩的产品，而不是只有 demo 页面
- 已完成：
  - 核心玩法：种花、花圃、详情、编辑、删除、点赞、送玫瑰、资料页
  - 核心体验：AI 回复、音效、动态背景、烟花、实时更新
  - 核心安全：JWT、Refresh Token、速率限制、私密玫瑰、账号软删除
  - 核心工程：WASM 业务下沉、测试覆盖率、CI、Docker、Swagger

### Phase 2：上线准备

- 状态：`进行中`
- 目标：把当前项目从“本地开发可用”推进到“外网可访问、可稳定演示”
- 当前小目标：
  - [x] 明确 Cloudflare 方案边界：Web 先上，后端按 API 分阶段迁移到 Workers
  - [x] 确定生产部署拓扑：Vercel Web + AWS Lightsail Rust API + Docker Postgres
  - [x] 补充部署文档、环境变量、服务器操作记录与故障处理
  - [x] 完成 Rust 后端线上环境并跑通基本冒烟检查
  - [ ] 将 Vercel 生产环境变量切到 Lightsail 后端并重新部署

### Phase 3：多端闭环

- 状态：`进行中`
- 目标：让小程序不只是“代码存在”，而是能真机走通核心路径
- 当前小目标：
  - [ ] 接入微信登录：`wx.login()` → `/api/auth/wechat-login`
  - [ ] 完成真机联调：登录、种花、花圃、详情、静默刷新、WASM
  - [ ] 补一轮小程序体验问题修复

### Phase 4：用户验证

- 状态：`进行中`
- 目标：验证 Roselet 是否真的让人愿意用，而不是只在代码层面完整
- 当前小目标：
  - [x] 增加公开使用动态页，用现有数据库聚合判断是否有人在用
  - [ ] 邀请至少 5 个真实用户试用
  - [ ] 收集反馈：注册是否顺滑、种花是否有表达欲、花圃是否有互动感
  - [ ] 以 100 个活跃注册用户作为是否买服务器/域名的第一条判断线
  - [ ] 根据反馈决定优先级：国际化 / 社交传播 / 运营玩法 / Web3

## 接下来 3 个小目标

1. 将 Vercel 生产环境变量切到 `http://47.131.238.0`，重新部署 Web。
2. 用线上 Web 跑完整冒烟：注册、登录、种花、花圃、详情、点赞、反馈。
3. 绑定正式域名并启用 HTTPS，再邀请第一批真实用户试用。

## 下一步

- 我们下一步应该先做：`配置 Vercel 环境变量，让线上 Web 调用 Lightsail Rust 后端`
- 当前已经完成：
  - `Vercel` 前端真实上线
  - `AWS Lightsail` 服务器创建并绑定静态 IP：`47.131.238.0`
  - `Rust Axum backend + Docker Postgres` 已在 Lightsail 启动
  - `Caddy` 已监听 `80` 并反代到后端 `3001`
  - `GET /health`、`GET /api/garden`、注册、种花、详情读取均已公网冒烟通过
  - `GET /api/garden` Worker 真实查 `Neon`
  - `GET /api/rose/:id` Worker 迁移完成，私有访问规则已对齐 Rust
  - `POST /api/auth/refresh` / `POST /api/auth/logout` Worker 最小闭环已迁移
  - `GET /api/stats` Worker 聚合统计已迁移
  - Web 已开始把 `refresh/logout` 和 `garden/rose detail` 切到 Worker 基址
  - Web 已新增 `/stats` 使用动态后台，显示 100 用户判断线进度
- 现在最有价值的动作变成：
  - 在 Vercel 设置 `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_AUTH_API_URL` / `NEXT_PUBLIC_READ_API_URL` / `NEXT_PUBLIC_WS_URL`
  - 重新部署 Vercel 并通过浏览器跑完整线上冒烟
  - 再考虑域名、HTTPS、备份和监控

### Cloudflare 判断

- 当前结论：`可以部署，但推荐 Web 先上 Cloudflare，后端分阶段迁移`
- 详细路线图：`docs/CLOUDFLARE_DEPLOYMENT_ROADMAP.md`

### 当前最低成本部署判断

- 当前推荐：`Vercel + AWS Lightsail Rust backend + Docker Postgres`
- 对比文档：`docs/DEPLOYMENT_OPTIONS_COMPARISON.md`
- 当前操作手册：`docs/AWS_LIGHTSAIL_DEPLOYMENT.md`

### 当前免费部署方案

- 当前推荐：`Vercel + Neon Free + Cloudflare Workers（后端迁移中）`
- 详细方案：`docs/FREE_DEPLOYMENT_PLAN.md`
- 执行清单：`docs/FREE_DEPLOYMENT_CHECKLIST.md`
- 无绑卡迁移计划：`docs/CLOUDFLARE_MIGRATION_PLAN.md`

### 当前真实上线状态

- `Vercel` 前端已成功创建并可访问
- 当前线上地址：`https://roselet-web.vercel.app`
- `Render` 与 `Koyeb` 在真实部署中都被支付验证拦住
- 后端当前已切换为：`AWS Lightsail 上运行 Rust Axum + Docker Postgres`
- 后端公网地址：`http://47.131.238.0`
- 当前未完成：`Vercel 生产环境变量仍需切到 Lightsail 后端`
- Worker API 起点：`apps/worker-api`
- Worker 当前已迁移：
  - `GET /health`
  - `GET /api/garden`
  - `GET /api/rose/:id`
  - `GET /api/stats`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- Web 当前已切到 Worker 的调用：
  - `refreshAccessToken()`
  - `logout()`
  - `getGarden()`
  - `getRose()`
  - `getUsageStats()` / `/stats`

## 已完成

### 基础架构
- [x] Rust workspace + Axum 后端框架
- [x] Next.js 16 前端 + shadcn UI
- [x] pnpm monorepo 结构
- [x] PostgreSQL 数据库 + SQLx 迁移
- [x] GitHub Actions CI/CD

### 后端功能
- [x] POST /api/rose - 创建玫瑰（后台异步生成 AI 回复）
- [x] GET /health - 健康检查（数据库连接 + 版本信息）
- [x] GET /api/garden - 获取花圃（分页 + 颜色筛选）
- [x] GET /api/rose/:id - 获取单朵玫瑰
- [x] PUT /api/rose/:id - 编辑玫瑰（仅创建者）
- [x] DELETE /api/rose/:id - 删除玫瑰（仅创建者）
- [x] POST /api/auth/register - 用户注册（JWT）
- [x] POST /api/auth/deactivate - 注销账号（软删除 + 30 天冷却期恢复）
- [x] GET /api/my/roses - 获取个人花圃（需 JWT，分页）
- [x] GET /api/user/profile - 用户资料 + 种花统计（需 JWT）
- [x] POST /api/rose/:id/like - 点赞/取消点赞（需 JWT）
- [x] GET /api/ws - WebSocket 实时推送
- [x] GET /api/openapi.json - OpenAPI 3.0 规范
- [x] AI 个性化回复（OpenAI 兼容 API，后台异步）
- [x] 输入验证（颜色、字段长度、至少一个字段）
- [x] thiserror 错误处理（404/400/403/500 区分）
- [x] CORS 配置
- [x] JWT 认证（jsonwebtoken v9）
- [x] tracing 结构化日志（tracing-subscriber）
- [x] Swagger API 文档（/swagger）

### 前端功能
- [x] 首页：规则介绍 + "种一朵玫瑰"按钮
- [x] 种花页：交互式玫瑰（3 个可点击热点）+ 对话框输入 + 种植成功动画
- [x] 花圃页：分页加载 + 卡片展示 + WebSocket 实时更新 + 颜色筛选
- [x] 玫瑰详情页：/rose/[id] + 编辑/删除（owner）+ 点赞 + AI 回复展示
- [x] 登录页：昵称注册 + JWT 存储
- [x] 登录页：支持冷却期账号恢复提示
- [x] 导航栏：登录状态 + 昵称显示 + 登出 + 我的花圃 + 资料链接
- [x] 个人花圃页：/my + 只显示自己的玫瑰
- [x] 用户资料页：/profile + 种花统计
- [x] 资料页：注销账号入口 + 冷却期说明
- [x] 关于页：/about + /health 状态 + 帮助折叠 + 反馈表单 + 联系方式
- [x] 音效系统（Tone.js）：种植/点赞/通知/背景音乐 + 静音切换（默认开启）
- [x] 响应式布局
- [x] 深色星空主题（毛玻璃卡片 + 霓虹发光）
- [x] 日夜动态背景（8 时段渐变，跟随系统时间）
- [x] 种花成功烟花粒子动画
- [x] 种花/点赞强制登录，登录后跳回原页面
- [x] 玫瑰点击绽放特效（全局 click → 玫瑰 emoji 弹出动画）
- [x] 玫瑰→声音融合：详情页"听这朵玫瑰" + 成功页自动播放 + 卡片悬停音效
- [x] 情绪示波器：预设模式 + 文字输入实时驱动音乐（TextAnalyzer 接口）

### 测试
- [x] 110 个后端测试（60 集成 + 50 单元）
- [x] 139 个 Rust WASM/推荐模块测试
- [x] 146 个 Web 前端测试（20 套件）
- [x] 66 个小程序测试（6 套件）
- [x] 覆盖率：Rust workspace 90.37% 行覆盖；Web 91.32% statements / 96.48% lines；小程序 99.33% statements / 100% lines / 96.05% branches
- [x] 覆盖率门禁：Web + 小程序 Jest coverage threshold 已接入本地脚本与 CI
- [x] 质量门禁：TypeScript、ESLint、cargo-deny、Next build、小程序 build 已接入本地 justfile 与 CI
- [x] RoseCard 通用组件（消除 garden/my 重复代码）

### 部署
- [x] Docker 一键部署（docker-compose：PostgreSQL + 后端 + 前端）
- [x] Swagger API 文档（/swagger，OpenAPI 3.0）

### WASM 推荐模块
- [x] 纯 Rust → WASM 智能内容推荐（crates/recommend）
- [x] 中文关键词词典（45 个词，8 个分类）
- [x] 花语数据库 + 主题推荐 + 颜色推荐算法
- [x] 种花页面集成推荐卡片
- [x] wasm-pack 构建流程（112KB）
- [x] emotion.rs：analyze_text() WASM 函数，48 关键词，三类情绪权重评分

### 文档
- [x] README.md（英文）+ README_zh.md（中文）
- [x] CONTRIBUTING.md（英文）
- [x] CLAUDE.md / DEVLOG.md / PROGRESS.md
- [x] Rust Dev Workflow 经验库：`docs/RUST_DEV_WORKFLOW_EXPERIENCE.md`
- [x] 小程序云测验收流程：`docs/MINIPROGRAM_CLOUD_TEST.md`（含 AIMonkey / AI 自定义测试）
- [x] Tauri Spike 方案：`docs/TAURI_SPIKE.md`
- [x] 多语言策略：`docs/I18N_STRATEGY.md`（当前默认中文，后续 i18n 优先 Rust WASM 单一事实来源）

## 最近完成（会话 #29–43）

### 覆盖率提升（会话 #29）
- [x] 私密玫瑰后端访问控制补齐：公共花圃隐藏、详情仅 owner、非 owner 点赞返回 404、公共 WebSocket 不广播
- [x] Web 创建玫瑰正确传递 `is_private`，详情请求带认证头
- [x] 后端集成测试改为生产 `create_app` 路由，避免测试路由与线上路由分叉
- [x] 后端测试清库改为 `TRUNCATE ... RESTART IDENTITY CASCADE`，清理 likes/refresh_tokens/feedbacks 残留
- [x] Web 覆盖 RosePlayer、音频、WASM wrapper、认证刷新、反馈、Nav、Fireworks、详情编辑删除等路径
- [x] 修复星尘粒子 `left` 随机数缺少 16-bit mask 导致越界的问题

### 当前测试状态
- Rust nextest: 249 passed
- Web Jest: 146 passed
- Miniprogram Jest: 66 passed
- Total: 461 passed
- Rust llvm-cov workspace: 90.37% 行覆盖
- Web Jest coverage: 91.32% statements / 96.48% lines
- Miniprogram Jest coverage: 99.33% statements / 100% lines / 96.05% branches
- Frontend coverage gate: `pnpm test:coverage` / `just coverage`
- Quality gates: `just typecheck` / `just lint` / `just audit` / `just next-build` / `just miniprogram-build`

### Rust WASM 架构深化
- [x] `audio.rs`：玫瑰属性→示波器音频参数（12 tests）
- [x] `color.rs`：颜色元数据单一事实来源（3 tests），Web + 小程序同源
- [x] `offline.rs`：乐观更新和花圃缓存合并规则（Web IndexedDB + 小程序 wx storage 已接入）
- [x] 双令牌静默刷新拦截器（小程序 request.ts，Promise 并发锁）
- [x] storage.ts 新增 getRefreshToken/setRefreshToken/logout 清除 refresh key

### DRY 大扫除（净删 ~500 行 TS）
- [x] 删 miniprogram/utils/validate.ts（plant.rs 已覆盖）
- [x] 删 miniprogram/utils/constants.ts（color.rs 替代）
- [x] rose-sound.ts：删除 TS fallback，强制 WASM，playRose→playWithParams
- [x] text-to-sound.ts：135行→35行，删 LocalKeywordAnalyzer（emotion.rs 替代）
- [x] 删 52 个 TS 算法测试（Rust 侧已覆盖）
- [x] Web rose-card.tsx + rose/[id]/page.tsx：COLOR_MAP → colorEmoji/colorLabel

### 关于&反馈功能
- [x] `migrations/007_create_feedbacks.sql`：feedbacks 表
- [x] `routes/feedback.rs`：POST /api/feedback（匿名/登录均可提交，登录用户关联 user_id）
- [x] `/api/feedback` 后端路由注册 + OpenAPI 文档 + 8 个集成测试

### 送玫瑰功能（会话 #37）
- [x] `migrations/009_add_recipient.sql`：roses 表加 `recipient_nickname` + `recipient_user_id`
- [x] CreateRose 加 recipient 字段，种花时查/建接收人，防止送给自己
- [x] `GET /api/my/roses?view=received` 查看收到的玫瑰
- [x] get_rose 允许接收人查看私密玫瑰
- [x] WASM `build_plant_body` 支持 recipient_nickname
- [x] 前端种花页加「送给谁？」输入框，按钮文案联动
- [x] RoseCard + 详情页显示赠送关系

### 可选密码 + 生产安全加固（会话 #37）
- [x] `migrations/010_add_passphrase.sql`：users 表加 `passphrase_hash`
- [x] 三态认证路由：新用户 / 无密码老用户 / 有密码验证
- [x] 密码哈希：SHA-256 → Argon2id（OWASP 推荐，内存硬度防 GPU 爆破）
- [x] CORS：`AllowOrigin` 改为 `ALLOWED_ORIGINS` 环境变量
- [x] 速率限制：接入 register + create_rose 路由
- [x] JWT 强制：生产环境用默认密钥拒绝启动
- [x] docker-compose.yml 加 `NODE_ENV` + `ALLOWED_ORIGINS`

### 文档
- [x] `docs/PRESENTATION.md`：分享讲稿
- [x] `docs/GIFT_ROSE.md`：送玫瑰需求文档
- [x] `docs/screenshots/`：6 张界面截图

## 待办

- [ ] **部署上线**：选 VPS / Cloudflare Tunnel 方案，Web 端先上
- [ ] **小程序微信登录**：`wx.login()` → `/api/auth/wechat-login`，零成本
- [ ] **真机联调**：AppID 已有，拉起后端验证双令牌 + WASM 花瓣
- [ ] **找 5 个真实用户试用**
- [ ] **多语言 Spike**：若试用反馈需要英文，再按 `docs/I18N_STRATEGY.md` 从 Rust `Locale` + WASM 文案映射开始
- [ ] Web3 功能（已设计，待实现）
  - Ethereum Solidity + Solana Anchor 双链，ChainAdapter trait
  - 上链内容：精选一句话（≤200字）+ 颜色，完整内容留链下
