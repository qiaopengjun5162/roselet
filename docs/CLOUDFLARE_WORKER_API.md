# Cloudflare Worker API 起步说明

> 更新时间：2026-06-24（认证最小闭环已接入）

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

1. 准备 Web 侧先切 `refresh/logout`
2. 迁移写接口
3. 再迁 `register` / `profile` 等其余认证接口
4. 最后再处理 WebSocket / Durable Objects

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
- `ALLOWED_ORIGINS`

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
