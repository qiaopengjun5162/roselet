# CLAUDE.md - Roselet

> **新会话开始时，先读 `DEVLOG.md` 了解上次进度。**

## 项目简介
Roselet 是一个社区破冰互动 Web 应用：用户种下玫瑰（感恩）、花苞（期待）、尖刺（焦虑），形成社区花圃。

## 技术栈
- 后端：Rust + Axum + SQLx + PostgreSQL（端口 3001）
- 前端：Next.js 15 + shadcn UI + pnpm（端口 3000）
- 数据库：PostgreSQL（本地 roselet 数据库）

## 项目结构
```
roselet/
├── apps/web/           # Next.js 前端
├── crates/backend/     # Rust Axum 后端
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
```

## API
```
POST   /api/rose         # 种一朵玫瑰
GET    /api/garden       # 获取花圃所有玫瑰
GET    /api/rose/:id     # 获取单朵玫瑰
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
