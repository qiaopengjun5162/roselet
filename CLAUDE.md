# CLAUDE.md - Roselet

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

## 常用命令
```bash
# 后端
cd crates/backend && cargo run

# 前端
cd apps/web && pnpm dev

# 数据库迁移
cd crates/backend && sqlx migrate run
```

## API
```
POST   /api/rose         # 种一朵玫瑰
GET    /api/garden       # 获取花圃所有玫瑰
GET    /api/rose/:id     # 获取单朵玫瑰
```

## 开发规范
- 每次修改都要 commit 和 push
- 测试覆盖率尽可能 100%
- 代码模块化，附必要注释
- 及时更新文档
