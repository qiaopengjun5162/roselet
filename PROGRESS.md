# Roselet 开发进度

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
- [x] GET /health - 健康检查（数据库连接 + 版本信息）
- [x] GET /api/garden - 获取花圃（分页 + 颜色筛选）
- [x] GET /api/rose/:id - 获取单朵玫瑰
- [x] PUT /api/rose/:id - 编辑玫瑰（仅创建者）
- [x] DELETE /api/rose/:id - 删除玫瑰（仅创建者）
- [x] POST /api/auth/register - 用户注册（JWT）
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
- [x] tracing 结构化日志（tracing-subscriber）

### 前端功能
- [x] 首页：规则介绍 + "种一朵玫瑰"按钮
- [x] 种花页：交互式玫瑰（3 个可点击热点）+ 对话框输入 + 种植成功动画
- [x] 花圃页：分页加载 + 卡片展示 + WebSocket 实时更新 + 颜色筛选
- [x] 玫瑰详情页：/rose/[id] + 编辑/删除（owner）+ 点赞 + AI 回复展示
- [x] 登录页：昵称注册 + JWT 存储
- [x] 导航栏：登录状态 + 昵称显示 + 登出 + 我的花圃 + 资料链接
- [x] 个人花圃页：/my + 只显示自己的玫瑰
- [x] 用户资料页：/profile + 种花统计
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
- [x] 49 个小程序测试（5 套件）
- [x] 覆盖率：Rust workspace 90.37% 行覆盖；Web 91.32% statements / 96.48% lines；小程序 98.87% statements / 100% lines
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

## 最近完成（会话 #23–24）

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

## 待办

- [ ] **小程序真机联调**：AppID 已有，需拉起后端验证双令牌 + WASM 花瓣
- [ ] **多语言 Spike**：若试用反馈需要英文，再按 `docs/I18N_STRATEGY.md` 从 Rust `Locale` + WASM 文案映射开始
- [ ] Web3 功能（已设计，待实现）
  - Ethereum Solidity + Solana Anchor 双链，ChainAdapter trait
  - 上链内容：精选一句话（≤200字）+ 颜色，完整内容留链下
