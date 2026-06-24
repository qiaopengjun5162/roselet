# 部署方案对比

> **历史方案说明**
>
> 当前 Roselet 生产环境已切换为 `Vercel Web + AWS Lightsail Rust backend + Docker Postgres + Caddy HTTPS`，详见 [AWS_LIGHTSAIL_DEPLOYMENT.md](AWS_LIGHTSAIL_DEPLOYMENT.md)。
> 本文档记录的方案对比仅作为历史参考，不再维护。

> 更新时间：2026-06-23

## 先给结论

如果目标是“尽快上线、成本尽量低、改造尽量少”，我当前推荐的优先级是：

1. **主应用优先考虑 `Vercel`**
2. **文档/介绍页可以考虑 `GitHub Pages`**
3. **Cloudflare 适合作为中长期优化路线，不是当前最低工程成本路线**

也就是说，最现实的组合不是“只选一个平台”，而是：

- 主应用：`Vercel`
- 文档/展示页：`GitHub Pages`
- 后端：暂时保留独立 Rust 服务
- 数据库：暂时保留现有 PostgreSQL

这套方案对当前项目来说，通常比“立刻全迁 Cloudflare 原生架构”更便宜，也更快拿到结果。

## 为什么不是 GitHub Pages 直接搞定全部

GitHub 官方把 GitHub Pages定义得很清楚：它是 **static site hosting service**，直接托管仓库里的 HTML、CSS、JavaScript 文件，可选构建后发布。[GitHub Pages 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

这意味着：

1. 它很适合：
   - 项目主页
   - 文档站
   - 展示型 landing page
2. 它不适合当前 Roselet 主应用：
   - 我们有 Next.js 动态页面
   - 我们有登录、JWT、刷新令牌
   - 我们有 Rust API
   - 我们有 WebSocket

所以 GitHub Pages 的定位应该是：

- `能用`
- `但只适合配套站点，不适合承载主产品`

## 为什么 Vercel 很适合当前项目的 Web 层

Vercel 官方对 Next.js 的定位非常直接：Next.js 是它维护的 full-stack React framework，部署到 Vercel 是 **zero-configuration**，并且在可扩展性、可用性和全球性能上有额外增强。[Vercel Next.js 文档](https://vercel.com/docs/frameworks/full-stack/nextjs)

对于我们当前项目，这个优势非常现实：

1. `apps/web` 本身就是 Next.js
2. 我们现在最需要的是“先把 Web 上线”
3. 相比 Cloudflare 路线，Vercel 对当前 Web 层的改造成本更低

Vercel 对 Next.js 还明确提供：

- ISR
- SSR
- 图片优化
- 全局 CDN

官方文档还特别提到，自托管时 ISR 默认只是在单区域工作，且默认不会把生成结果持久化到 durable storage；而在 Vercel 上，ISR 有 CDN、持久化和全局更新能力。[Vercel ISR 文档](https://vercel.com/docs/frameworks/full-stack/nextjs)

所以从“少折腾、尽快上线”角度看：

- `Vercel 是当前 Web 层最省心的方案`

## Vercel 的限制

Vercel Hobby 官方文档也写得很清楚：

- 免费 Hobby 是给 **personal, non-commercial** 用的
- 超限后通常要等 30 天窗口过去
- Hobby 包含的关键额度包括：
  - `1,000,000` Function Invocations
  - `1,000,000` Edge Requests
  - 默认函数时长 `10s`，可配置到 `60s`
  - `100` deployments/day

这些信息都在官方 Hobby 文档里能查到。[Vercel Hobby 官方文档](https://vercel.com/docs/plans/hobby)

这意味着：

1. 做 demo、试用、个人项目，非常合适
2. 如果后面变成商业化、团队化、或者流量明显上涨，要准备升级

## 为什么 Cloudflare 不是“当前最低成本”

Cloudflare 当然能做，而且长期潜力很好：

- 官方已支持 Next.js 通过 OpenNext adapter 部署到 Workers
- 支持 App Router、Route Handlers、SSR、ISR、Server Actions、Streaming 等能力
- Hyperdrive 可接现有 Postgres / MySQL
- Durable Objects 能承接多客户端实时协同

这些官方文档都已经确认了：

- [Cloudflare Next.js 官方文档](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare Hyperdrive 官方文档](https://developers.cloudflare.com/hyperdrive/)
- [Cloudflare Durable Objects WebSocket 官方文档](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

但问题在于：**当前 Roselet 后端不是 Cloudflare 原生架构**。

我们现在后端依赖的是：

- `TcpListener + axum::serve`
- `sqlx::PgPool`
- `tokio::broadcast`

要把它迁到 Cloudflare 风格，通常要改：

1. 运行模型
2. 数据库访问方式
3. 实时同步方案

所以如果把“工程时间”也算成本，Cloudflare 当前对 Roselet 并不是最低成本路线。

## Cloudflare 的优势是什么

Cloudflare 的优势不是“当前最省改造”，而是：

1. 长期 infra 成本可能更低
2. 更接近统一边缘架构
3. 适合后续逐步把：
   - Web
   - API
   - 部分实时能力
   - 数据访问
   
   都往同一个平台收拢

官方定价页显示，Workers Free 当前有：

- `100,000 requests/day`
- 每次调用 `10 ms` CPU time
- Hyperdrive Free `100,000 / day` 数据库查询

这些额度对 demo 和小范围试用有吸引力，但对当前 Roselet 这种“动态页面 + 登录 + DB + WebSocket”的应用，不该只看平台费，不看迁移成本。[Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

## 三种方案横向对比

| 方案 | 适合什么 | 对当前 Roselet 的适配度 | 平台直接成本 | 工程改造成本 | 我的判断 |
|------|----------|--------------------------|--------------|--------------|----------|
| GitHub Pages | 文档、介绍页、静态展示 | 低 | 最低 | 低 | 只适合文档/官网，不适合主应用 |
| Vercel | Next.js 主应用前端 | 高 | 低 | 最低 | 当前最适合先上线 Web |
| Cloudflare | 中长期统一边缘架构 | 中 | 低到中 | 高 | 值得做，但不是当前最省力 |

## 我对当前项目的推荐组合

### 推荐组合 A：最快上线

- 主应用：`Vercel`
- 后端：保留现有 Rust 服务
- 数据库：保留现有 PostgreSQL
- 文档页：`GitHub Pages`

#### 优点

- 改造最少
- 上线最快
- 最容易先拿到真实用户反馈

#### 缺点

- 平台分散
- 后端还不是“零服务器”

### 推荐组合 B：中长期优化

- 主应用：`Cloudflare Workers`
- 数据库：`Hyperdrive + 现有 Postgres`
- 实时层：`Durable Objects`
- 文档页：`GitHub Pages`

#### 优点

- 长期架构更统一
- 边缘能力更强
- 更适合把静态、动态、实时逐步收拢

#### 缺点

- 当前迁移成本高
- 不是最快可交付路径

## 当前最值得做的事

如果我们按“最低综合成本”来算，我建议优先做：

1. **先把 Web 部署到 Vercel**
2. **把项目文档/对外介绍页准备成 GitHub Pages 可发布内容**
3. **后端先不大改**
4. **等上线后再决定是否推进 Cloudflare v2**

## 最终推荐

### 当前最佳方案

`Vercel + Rust backend + PostgreSQL + GitHub Pages`

### 原因

1. 对当前代码改动最少
2. 成本足够低
3. 最快拿到真正能访问的网址
4. 不会为了省平台费，先付出过大的重构成本

### 中长期方向

等 Web 先上线后，再评估是否把架构升级到：

`Cloudflare Web + Hyperdrive + Durable Objects`

## 参考来源

- [Vercel Next.js 官方文档](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel Hobby 官方文档](https://vercel.com/docs/plans/hobby)
- [GitHub Pages 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Cloudflare Next.js 官方文档](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare Workers Pricing 官方文档](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Hyperdrive 官方文档](https://developers.cloudflare.com/hyperdrive/)
- [Cloudflare Durable Objects WebSocket 官方文档](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
