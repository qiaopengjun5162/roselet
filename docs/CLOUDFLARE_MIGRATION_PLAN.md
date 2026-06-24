# Cloudflare 无绑卡迁移计划

> **历史方案说明**
>
> 当前 Roselet 生产环境已切换为 `Vercel Web + AWS Lightsail Rust backend + Docker Postgres + Caddy HTTPS`，详见 [AWS_LIGHTSAIL_DEPLOYMENT.md](AWS_LIGHTSAIL_DEPLOYMENT.md)。
> 本文档记录的 Cloudflare 无绑卡迁移路线仅作为历史参考，不再维护。

> 更新时间：2026-06-24（refresh/logout 已迁移）

## 当前结论

如果坚持 `不绑卡`，当前最现实的可持续路线只剩：

1. 前端继续保留 `Vercel`
2. 数据库继续保留 `Neon Free`
3. 后端开始迁移到 `Cloudflare Workers`

原因不是 Cloudflare 当前最省工程量，而是：

- `Render` 当前要求信用卡验证
- `Koyeb` 当前直接要求进入 `Pro plan` 并绑定支付方式
- `Neon` 官方定价页明确写了 `No credit card required`
- `Cloudflare Workers` 官方提供 `Free plan`

## 为什么现在要改路线

前一轮推荐的免费后端平台已经在真实操作里被排除了：

### Render

- 当前实际流程被 `Add Card` 验证弹窗拦住
- 无法在“不绑卡”前提下继续部署后端

### Koyeb

- 当前实际流程进入：
  - `To get started deploying, add your payment information`
  - `Pro plan is $29 per month`
- 这已经不是“先免费试跑”的路径

所以现在不是“Cloudflare 比 Render/Koyeb 更省事”，而是：

`在不绑卡约束下，Cloudflare 成了唯一还值得继续投入的后端路线。`

## 目标重定义

### v1 目标

先得到一个 **无绑卡、可继续开发、可逐步替换 Rust 后端** 的线上后端入口。

这版不追求一次性把当前 Rust API 全迁完，只追求：

1. 仓库里有明确的 Cloudflare Worker 入口
2. 部署配置有骨架
3. 最简单的 `/health` 能先落地
4. 为后续迁移认证、花圃读取、写接口、实时能力留好位置

### v2 目标

逐步把当前 Rust 后端拆成 Cloudflare 原生能力：

1. 只读 API
2. 认证相关 API
3. 写接口
4. 实时广播（Durable Objects）

## 当前后端里最不能直接搬的部分

### 1. 常驻 TCP 服务

- `crates/backend/src/main.rs`
  - `TcpListener::bind`
  - `axum::serve`

Workers 没有这类常驻监听进程模型。

### 2. 进程内连接池

- `crates/backend/src/db.rs`
  - `sqlx::PgPool`

Cloudflare 更适合通过 Hyperdrive + 兼容驱动访问外部 Postgres，而不是直接复用当前 `PgPool` 生命周期。

### 3. 进程内广播

- `crates/backend/src/state.rs`
  - `tokio::sync::broadcast`

这类状态需要改成 Durable Objects 或其他跨请求协调机制。

## 迁移顺序

### Phase A：先起 Worker 外壳

先做：

- 新建 `apps/worker-api`
- 用 Worker 运行时提供：
  - `/health`
  - `GET /api/garden`
  - CORS
  - 环境变量类型

这一步的目的不是立刻替换现有后端，而是让仓库开始拥有“无绑卡后端入口”。

### Phase B：迁移最简单的只读接口

优先迁：

- `GET /api/rose/:id` `已完成`

原因：

- 没有写放大
- 没有刷新令牌撤销
- 没有账号生命周期边界

当前结果：

- `GET /api/garden` 已迁移
- `GET /api/rose/:id` 已迁移
- 私有访问规则已对齐 Rust：
  - 公开玫瑰匿名可见
  - 私有玫瑰只允许 owner / recipient
  - 无权限统一返回 `404`

### Phase C：迁移认证与写接口

再迁：

- `POST /api/auth/register`
- `POST /api/auth/refresh` `已完成`
- `POST /api/auth/logout` `已完成`
- `POST /api/rose`
- `PUT /api/rose/:id`
- `DELETE /api/rose/:id`

当前结果：

- 认证最小闭环已起：
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- 这让 Web / 小程序当前最依赖的双令牌续期与撤销契约，已经可以先切到 Worker

### Phase D：迁移实时层

最后迁：

- `GET /api/ws`

这一步默认需要 Durable Objects，不应低估。

## 当前执行策略

### 先不做的事

- 不在这一轮强行把 Rust 路由逻辑整体平移
- 不在这一轮重写完整认证
- 不在这一轮迁 WebSocket

### 这一轮要做的事

1. 把无绑卡部署判断写进仓库
2. 起一个最小 Cloudflare Worker API 骨架
3. 补充本地开发 / 部署说明
4. 更新项目进度和路线图

## 现在的推荐组合

在“不绑卡”的约束下，当前推荐组合更新为：

1. Web：`Vercel`
2. DB：`Neon Free`
3. API：`Cloudflare Workers（迁移中）`

## 一句话说明

Roselet 当前已经验证：前端可以免费上线到 Vercel，但无绑卡前提下，通用 Rust 后端托管平台会被支付验证拦住，所以后端必须转向 Cloudflare Workers 分阶段迁移路线。
