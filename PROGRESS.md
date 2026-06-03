# Roselet 开发进度

## 已完成

### 基础架构
- [x] Rust workspace + Axum 后端框架
- [x] Next.js 15 前端 + shadcn UI
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
- [x] 72 个后端测试（36 集成 + 36 单元）
- [x] 120 个前端单元测试（15 套件）
- [x] 17 个 Rust WASM 单元测试（emotion 情绪分析）
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

## 待办

- [x] 优化 profile SQL（4 次查询 → 1 次聚合）
- [x] 提取公共 auth token 函数
- [x] WASM analyze_text 接入前端（WasmAnalyzer，降级 LocalKeywordAnalyzer）
- [x] text-to-sound.ts / rose-sound.ts 前端单元测试（各 16/19 个用例）
- [ ] 小程序适配（uni-app，首发微信）
- [ ] Web3 功能（已设计，待实现）
  - 用户钱包直付 Gas + 平台服务费
  - 先走正统 Web3 流程（用户学习钱包/Gas），后续加人民币支付
  - Ethereum Solidity + Solana Anchor 双链
  - ChainAdapter trait 统一接口
  - 钱包可选绑定，上链可选触发
  - 上链内容：用户精选一句话（≤200字）+ 颜色
  - 完整内容留链下，链上存精华
