# CLAUDE.md - Roselet

> **新会话开始时，先读 `DEVLOG.md` 了解上次进度。**

## 项目简介
Roselet 是一个社区破冰互动 Web 应用：用户种下玫瑰（感恩）、花苞（期待）、尖刺（焦虑），形成社区花圃。

## 技术栈
- 后端：Rust + Axum + SQLx + PostgreSQL（端口 3001）
- 前端：Next.js 15 + shadcn UI + pnpm + Tone.js（端口 3000）
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
just audit            # 依赖审计
just changelog        # 生成 CHANGELOG
just wasm              # 构建 WASM 推荐模块
just wasm-mini         # 为小程序构建 WASM（编译 + WXWebAssembly 补丁）
just miniprogram       # 小程序开发模式
just miniprogram-build # 小程序生产构建
```

## API
```
POST   /api/auth/register  # 用户注册（JWT）
GET    /health             # 健康检查（数据库连接 + 版本信息）
POST   /api/rose           # 种一朵玫瑰（后台异步生成 AI 回复）
PUT    /api/rose/:id       # 编辑玫瑰（仅 owner）
DELETE /api/rose/:id       # 删除玫瑰（仅 owner）
GET    /api/garden         # 获取花圃（分页，可选 ?color=red/white/yellow）
GET    /api/rose/:id       # 获取单朵玫瑰
GET    /api/my/roses       # 获取个人花圃（需 JWT，分页）
GET    /api/user/profile   # 获取用户资料 + 种花统计（需 JWT）
POST   /api/rose/:id/like  # 点赞/取消点赞（需 JWT）
GET    /api/ws             # WebSocket 实时推送
GET    /swagger            # Swagger API 文档
GET    /oscilloscope       # 情绪示波器（前端路由，非 API）
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

## 开发规范
- 每次修改都要 commit 和 push（Conventional Commits）
- 测试运行器：cargo-nextest（不是 cargo test）
- 测试覆盖率尽可能 100%
- 代码模块化，附必要注释
- 及时更新文档（PROGRESS.md、CLAUDE.md）
