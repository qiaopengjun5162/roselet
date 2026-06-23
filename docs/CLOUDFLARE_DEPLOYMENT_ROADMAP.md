# Cloudflare 部署路线图

> 更新时间：2026-06-23

## 结论

可以部署到 Cloudflare，但不适合把当前项目“一把梭”原封不动塞进一个 Worker。

更准确的判断是：

1. `apps/web` 这层很适合优先上 Cloudflare Workers。
2. 当前 Rust Axum 后端不适合直接按现状搬进单个 Worker 运行。
3. 如果坚持“尽量零服务器”，后端需要改成 Cloudflare 原生形态，而不是继续保留现在的 `TcpListener + axum::serve + sqlx::PgPool + tokio broadcast` 模式。

## 为什么说“能上”，但不能一步到位

### 能上的部分

- 当前 Web 前端是 Next.js 16。
- Cloudflare 官方当前明确支持 Next.js 部署到 Workers，并说明可以通过 OpenNext adapter 部署。
- 官方文档列出的支持能力包括：
  - App Router
  - Pages Router
  - Route Handlers
  - React Server Components
  - SSG
  - SSR
  - ISR
  - Server Actions
  - Response streaming

这意味着：如果我们的 Web 目标是“先有一个稳定可访问的网址”，Cloudflare 对前端这层是可行的。

## 为什么说“当前后端不能直接照搬”

当前后端的运行模式是典型服务器进程：

- [crates/backend/src/main.rs](/Users/qiaopengjun/Code/Rust/roselet/crates/backend/src/main.rs)
  - `#[tokio::main]`
  - `TcpListener::bind`
  - `axum::serve`
- [crates/backend/src/db.rs](/Users/qiaopengjun/Code/Rust/roselet/crates/backend/src/db.rs)
  - `sqlx::PgPool`
- [crates/backend/src/state.rs](/Users/qiaopengjun/Code/Rust/roselet/crates/backend/src/state.rs)
  - `broadcast::Sender<RoseResponse>`

这和 Cloudflare Workers 的模型不一样。Workers 更像“请求触发的边缘运行时”，不是我们现在这种长期监听端口、持有进程内连接池和进程内广播状态的服务。

当前这几个点最不适合直接搬：

1. `TcpListener + axum::serve`
   - Workers 没有给你一个常驻 TCP 服务器进程去监听端口。
2. `sqlx::PgPool`
   - Workers 虽然能连外部数据库，但更推荐通过 Hyperdrive 和 Workers 兼容驱动工作。
   - 当前 `sqlx` 这套 Postgres 访问方式不等于“原样照搬到 Worker 就能跑”。
3. `tokio::broadcast`
   - 当前 WebSocket 实时广播依赖单个后端进程内状态。
   - Cloudflare 官方对于“多 WebSocket 连接之间的协调”明确建议使用 Durable Objects 作为单点协调层。

## Cloudflare 官方能力边界

### Next.js

- 官方文档说明可以通过 OpenNext adapter 把 Next.js 部署到 Workers。
- 也说明 `wrangler deploy` 可以自动检测现有 Next.js 项目并生成配置。

### WebSocket

- Workers 支持 WebSockets。
- 但如果应用需要在多个 WebSocket 连接之间协调状态，例如聊天室、多人匹配、广播同步，官方建议使用 Durable Objects 作为单点协调。

这对我们很关键，因为 Roselet 当前的实时花圃更新就属于“多客户端实时同步”问题。

### 数据库

- Hyperdrive 官方说明支持现有 Postgres / MySQL。
- 也说明可以继续使用现有数据库和常见驱动/ORM。

这意味着：数据库不一定要迁移成 D1。我们可以保留 Postgres，只是接入方式要调整。

### 免费额度

免费额度做 demo、内测、小流量试用是有希望的，但不能想得太乐观。

当前官方页面列出的几个关键限制：

- Workers Free：
  - `100,000 requests/day`
  - 每个 HTTP 请求 `10 ms` CPU time
- Hyperdrive Free：
  - `100,000` database queries/day

Cloudflare 也明确说明：等待网络请求本身不计入 CPU time，但我们这类带认证、数据库、AI 调用、SSR 的应用，整体架构仍然需要按限制设计。

结论是：

1. 免费额度足够我们先上线一个 demo 或小范围试用版。
2. 免费额度不适合把“完整生产版 + 高流量 + 重实时 + 很多数据库交互”当成长期默认方案。

## 推荐路线

### 推荐结论

推荐走：`Web 先上 Cloudflare，后端分阶段迁移`

不推荐直接做：`当前整个 Rust + Next + Postgres + WebSocket 一次性全改成单 Worker 架构`

### 最小可行路径

#### Phase A：Web 先上线

- 目标：先让别人能打开产品网址体验 Web
- 做法：
  - 把 `apps/web` 部署到 Cloudflare Workers
  - 后端 API 暂时继续保留现有 Rust 服务
  - Web 先通过环境变量请求现有后端
- 优点：
  - 风险最低
  - 改动最小
  - 最快拿到“线上可访问版本”

#### Phase B：后端边缘化

- 目标：减少传统服务器依赖
- 做法：
  - 先挑最简单的 API 迁到 Next Route Handlers 或单独 Worker
  - 例如：
    - `/health`
    - 公开花圃只读接口
    - 部分无需复杂状态的接口
- 难点：
  - JWT
  - 刷新令牌
  - 账号软删除
  - SQL 访问模式

#### Phase C：实时能力改造

- 目标：把 `/api/ws` 的进程内广播迁出
- 做法：
  - 用 Durable Objects 取代当前 `tokio::broadcast`
  - 让实时花圃更新由 DO 协调
- 这是整个 Cloudflare 化里最关键也最容易低估的一步

#### Phase D：决定是否全量迁移后端

- 到这一步再判断：
  - 是继续保留 Rust API 服务
  - 还是把核心 API 全迁到 Cloudflare 原生后端

## 当前项目对应的部署判断

### 现在就能做的

- [x] 评估 Cloudflare 路线是否可行
- [x] 确认 Next.js 前端可部署到 Workers
- [x] 确认 WebSocket/数据库有 Cloudflare 对应方案
- [ ] 生成 Cloudflare 部署配置草案
- [ ] 明确 Web-first 部署步骤

### 现在还不该直接做的

- [ ] 不应立即把整个 Rust 后端强行改写成 Worker 版本
- [ ] 不应在还没拿到第一版线上可访问环境前，就先重构所有实时和数据库层

## 接下来 3 个小目标

1. 先完成 Web-first 的 Cloudflare 部署设计。
2. 明确 Rust 后端是“暂时保留独立部署”还是“开始拆分一部分到 Workers”。
3. 输出一份能直接执行的部署清单，而不是停留在架构讨论。

## 下一步建议

下一步最值得做的是：

1. 为 `apps/web` 增加 Cloudflare 部署说明和配置草案。
2. 把生产环境拆成两个目标版本：
   - `v1`: Web 在 Cloudflare，后端保留 Rust 独立服务
   - `v2`: 实时和部分 API 逐步迁到 Cloudflare 原生能力
3. 把这条路线同步进项目进度文档，作为正式的上线计划。

## 对外可用的一句话

Roselet 可以部署到 Cloudflare，但最合理的路径不是“一次性全搬”，而是先把 Next.js Web 端部署到 Cloudflare，再按阶段把后端 API、数据库接入和实时能力逐步边缘化。
