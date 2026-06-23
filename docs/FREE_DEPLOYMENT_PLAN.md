# 免费部署方案

> 更新时间：2026-06-23

## 一句话结论

**可以先不买服务器。**

当前最现实的免费部署组合是：

1. 前端 Web：`Vercel Hobby`
2. Rust 后端：`Render Free Web Service`
3. PostgreSQL：`Neon Free`
4. 文档/介绍页：`GitHub Pages`

这套方案的优点是：

- 全部都可以先用免费资源
- 对当前代码改动最少
- 能最快把项目发出去给别人访问

## 为什么我现在推荐这套组合

### 1. Vercel 托管当前 Next.js Web 最省事

Vercel 官方文档对 Next.js 的描述非常直接：部署到 Vercel 是 **zero-configuration**，并且有全球性能和可用性增强。[Vercel Next.js 文档](https://vercel.com/docs/frameworks/full-stack/nextjs)

对我们当前项目来说，这意味着：

- `apps/web` 几乎就是现成最匹配的
- 不需要先为前端重构运行时
- 上线速度最快

Vercel Hobby 当前官方列出的关键免费额度还包括：

- `1,000,000` Function Invocations
- `1,000,000` Edge Requests
- 单个函数默认 `10s`，可配置到 `60s`
- `100` deployments/day

来源：[Vercel Hobby 官方文档](https://vercel.com/docs/plans/hobby)

### 2. Neon Free 适合当前 Postgres

Neon 官方文档明确写了 Free 适合 prototypes、side projects、quick experiments，并给出大致免费额度：

- `100 projects`
- `100 CU-hours/project/month`
- `0.5 GB` storage per branch
- `5 GB` egress

来源：[Neon Plans 文档](https://neon.com/docs/introduction/plans)

这对 Roselet 当前阶段是够用的，因为：

- 数据量还不大
- 真实用户量还没起来
- 我们现在更需要先跑通线上闭环

### 3. Render Free 可以先托管 Rust 后端

Render 官方文档说明：

- Free web service 空闲 `15 分钟` 会休眠
- 再次访问时会重新拉起，通常大约 `1 分钟`
- 每月 `750` free instance hours

来源：[Render Free 文档](https://render.com/docs/free)

所以它适合：

- demo
- 内测
- 低流量试用

但不适合：

- 追求首包稳定
- 高频实时互动
- 对 WebSocket 连续在线体验要求很高

### 4. GitHub Pages 只做文档或介绍页

GitHub 官方写得很清楚，GitHub Pages 是 **static site hosting service**，适合托管 HTML/CSS/JS 静态站。[GitHub Pages 文档](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

所以它适合：

- 项目主页
- 文档页
- 宣传页

不适合：

- 当前主应用
- 登录态
- 动态 API
- WebSocket

## 这套免费方案的真实代价

免费不等于没有代价，只是不花钱，改成花时间和体验成本。

### 你要接受的限制

1. Render 后端会休眠
   - 第一次访问可能慢
   - WebSocket 体验不稳定
2. 免费额度不是无限
   - 用户一多就会碰上限
3. 平台是分开的
   - 前端、后端、数据库不在一个地方

## 适合当前项目的判断

如果我们的目标是：

- 先上线
- 先让别人能访问
- 先拿到试用反馈
- 暂时不花钱

那这套方案是可行的。

如果目标是：

- 稳定生产
- 实时体验很好
- 长时间在线
- 后端永不休眠

那后面还是大概率要升级成付费方案，或者买一个最小 VPS。

## 当前推荐的免费上线版本

### v1：完全免费可访问版

- Web：Vercel
- API：Render Free
- DB：Neon Free
- Docs：GitHub Pages

### 适用目标

- 产品演示
- 朋友试用
- 小范围内测
- 作品集展示

## 具体怎么部署

### 第一步：数据库上 Neon

1. 注册 Neon
2. 创建一个 Postgres 数据库
3. 拿到 `DATABASE_URL`
4. 用这个库跑现有 SQLx 迁移

### 第二步：后端上 Render

1. 新建 Web Service
2. 连接 GitHub 仓库
3. 使用现有后端目录或 Dockerfile 部署
4. 配置环境变量：
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS`
   - `OPENAI_API_KEY`（可选）
   - `OPENAI_BASE_URL`（可选）
   - `OPENAI_MODEL`（可选）
5. 记录后端公网地址

### 第三步：前端上 Vercel

1. 导入 GitHub 仓库
2. 选择 `apps/web`
3. 配置环境变量：
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_WS_URL`
4. 部署并拿到前端域名

### 第四步：文档页上 GitHub Pages

1. 选一个静态文档目录
2. 开启 GitHub Pages
3. 发布项目介绍页或文档页

## 我建议的顺序

最好的推进顺序是：

1. 先把 Web 和 DB 路径确认
2. 再把后端挂到 Render
3. 跑通最小闭环：
   - 首页能打开
   - 注册能成功
   - 能种花
   - 花圃能展示
4. 最后再决定要不要补 GitHub Pages 的介绍页

## 现在要不要买服务器

我的明确建议还是：

**现在先不要买。**

先用这套免费方案把 v1 跑起来。

只有出现下面任一情况，再考虑买最小 VPS：

1. Render 休眠影响体验，无法接受
2. WebSocket 实时体验明显不行
3. 试用用户开始变多
4. 你想要一个更像正式产品的稳定环境

## 当前下一步

下一步最值得做的是：

1. 把 `Vercel + Render + Neon` 的部署步骤细化成执行清单
2. 确认当前仓库部署时需要哪些环境变量和构建命令
3. 直接开始做第一版免费上线
