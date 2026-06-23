# Cloudflare Worker API 起步说明

> 更新时间：2026-06-23

## 目标

这个目录用于承接 Roselet 在 `不绑卡` 约束下的后端迁移起点。

当前位置：

- 目录：`apps/worker-api`
- 运行时：Cloudflare Workers
- 框架：Hono

## 当前已提供

### 路由

- `GET /health`
  - 返回 Worker 运行状态
  - 返回关键环境变量是否已配置
- `GET /api/garden`
  - 当前是占位实现
  - 用于明确迁移入口，而不是维持空目录

### CORS

- 当前按 `ALLOWED_ORIGINS` 返回第一个 origin
- 未配置时回退为 `*`

## 为什么先这样起步

当前 Rust 后端不能直接搬到 Worker：

- 有 `TcpListener + axum::serve`
- 有 `sqlx::PgPool`
- 有 `tokio::broadcast`

所以先要有一个最小 Worker 外壳，后续再把 API 一条条迁过去。

## 下一步迁移顺序

1. 真正迁移 `GET /api/garden`
2. 迁移 `GET /api/rose/:id`
3. 迁移认证接口
4. 迁移写接口
5. 最后再处理 WebSocket / Durable Objects

## 本地命令

```bash
pnpm --filter @roselet/worker-api typecheck
pnpm --filter @roselet/worker-api dev
pnpm --filter @roselet/worker-api deploy
```

## 环境变量

当前预留：

- `APP_NAME`
- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`

后续如果接入 Hyperdrive，再新增 Cloudflare 对应 binding。
