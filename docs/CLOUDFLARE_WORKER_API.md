# Cloudflare Worker API 起步说明

> **历史方案说明**
>
> 当前 Roselet 生产环境已切换为 `Vercel Web + AWS Lightsail Rust backend + Docker Postgres + Caddy HTTPS`，详见 [AWS_LIGHTSAIL_DEPLOYMENT.md](AWS_LIGHTSAIL_DEPLOYMENT.md)。
> `apps/worker-api` 作为 Cloudflare 迁移起点保留在仓库中，仅作为历史参考，不再维护。

> 更新时间：2026-06-24（使用动态统计已接入）

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
  - 当前已接到 `Neon serverless driver`
  - 支持：
    - `page`
    - `per_page`
    - `color`
  - 当前会返回：
    - 公开花圃分页数据
    - nickname
    - like_count
    - gift 标记
- `GET /api/rose/:id`
  - 当前已接到 `Neon serverless driver`
  - 当前已对齐 Rust 版的基础可见性规则：
    - 公开玫瑰可匿名访问
    - 私有玫瑰只允许创建者或接收人访问
    - 未命中或无权限统一返回 `404`
  - 当前会返回：
    - 单朵玫瑰详情
    - nickname
    - like_count
    - recipient_user_id 仅用于 Worker 内部访问判断，不对外扩散额外语义
- `GET /api/stats`
  - 当前已接到 `Neon serverless driver`
  - 当前用于免费部署阶段的轻量运营可见性，不做第三方埋点
  - 当前是管理员后台接口，不是公开接口
  - 访问要求：
    - `Authorization: Bearer <access_token>`
    - token 对应用户 id 必须在 `ADMIN_USER_IDS` 白名单中
  - 当前错误语义：
    - 未登录或 token 无效返回 `401`
    - 非管理员返回 `403`
  - 当前会返回隐私安全的聚合数据：
    - 活跃用户总数
    - 玫瑰总数、公开玫瑰、私密玫瑰
    - 点赞总数、反馈总数
    - 近 7 天新增用户、玫瑰、反馈
    - 最近玫瑰时间、最近反馈时间
    - 距离 100 个用户判断线的进度
- `POST /api/auth/refresh`
  - 当前已接到 `Neon serverless driver`
  - 当前已对齐 Rust 版的基础行为：
    - 读取 `refresh_token`
    - 校验 token hash / revoked / expires_at
    - 只给活跃用户签发新 access token
  - 当前错误语义：
    - 无效或过期 refresh token 返回 `401`
    - 用户已软删除返回 `404`
- `POST /api/auth/logout`
  - 当前支持两种撤销路径：
    - Bearer access token：撤销该用户全部 refresh tokens
    - Bearer refresh token：按 token hash 撤销单个 refresh token
  - 当前错误语义：
    - token 缺失或无效返回 `401`

### 当前已开始切流的前端调用

- Web:
  - `refreshAccessToken()`
  - `logout()`
  - `getGarden()`
  - `getRose()`
  - `getUsageStats()` / `/stats`
- 当前策略：
  - 已迁移到 Worker 的只读和认证生命周期调用先切过去
  - 写接口、profile、feedback 等尚未迁移的调用继续留在原 `NEXT_PUBLIC_API_URL`

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

1. 配置生产 Worker 域名与 Vercel 环境变量
2. 让 `/stats` 真实连生产 Neon，作为是否值得买服务器的判断面板
3. 迁移写接口
4. 再迁 `register` / `profile` 等其余认证接口
5. 最后再处理 WebSocket / Durable Objects

## 本地命令

```bash
pnpm --filter @roselet/worker-api typecheck
pnpm --filter @roselet/worker-api test
pnpm --filter @roselet/worker-api dev
pnpm --filter @roselet/worker-api deploy
```

也可以从根目录运行：

```bash
pnpm worker:typecheck
pnpm worker:test
pnpm worker:dev
pnpm worker:deploy
```

## 环境变量

当前预留：

- `APP_NAME`
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_USER_IDS`
- `ALLOWED_ORIGINS`

Web 前端切流相关变量：

- `NEXT_PUBLIC_AUTH_API_URL`
- `NEXT_PUBLIC_READ_API_URL`
- `NEXT_PUBLIC_WORKER_API_URL`

## 架构边界

- Worker 当前是 `不绑卡上线` 的部署适配层，不是长期替代 Rust Axum 后端的业务核心。
- Rust WASM 仍负责跨端业务规则、推荐、文案映射、缓存合并等可测试逻辑。
- `/api/stats` 当前只做数据库聚合，不做复杂运营逻辑；未来买服务器后，可在 Rust Axum 中提供同名接口，Web 端切换成本只是一处 API 基址。
- `/api/stats` 默认按后台处理；如果未来要对外公开部分数据，应新增 `/api/stats/public`，只返回脱敏摘要，不复用管理员后台接口。

后续如果接入 Hyperdrive，再新增 Cloudflare 对应 binding。

## 这轮踩坑

### Worker 最小测试不要直接套现有 TS 配置

- 现象：
  - `apps/worker-api/tsconfig.json` 只挂了 `@cloudflare/workers-types`
  - 直接给 Worker 写 `node:test` 的 `.ts` 用例时，会报 Node 类型缺失
- 根因：
  - Worker 编译目标和 Node 测试目标不是同一套类型环境
- 解决：
  - 业务实现继续走 Worker `tsconfig`
  - 最小行为测试改成：
    - 先单独 `tsc` 编译目标文件
    - 再用原生 `node --test` 跑 `src/*.test.mjs`
- 当前命令：
  - `pnpm worker:test`

### NodeNext 下相对导入要显式写 `.js`

- 现象：
  - `tsc --module NodeNext --moduleResolution NodeNext` 编译 `auth.ts` 时，`import "./rose"` 会报缺少扩展名
- 根因：
  - NodeNext 模式按 ESM 规则解析相对路径，要求显式文件扩展名
- 解决：
  - Worker 内部跨文件引用统一写成 `./rose.js`
