# Roselet

![Rust](https://img.shields.io/badge/Rust-1.88.0-orange?logo=rust)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![License](https://img.shields.io/badge/License-MIT-blue)
![Live](https://img.shields.io/badge/Live-roselet--web.vercel.app-brightgreen)

> 种下一朵玫瑰，分享你的情绪，等待宇宙的回响。

Roselet 是一个社区破冰互动 Web 应用，灵感来自经典的”玫瑰、花苞、尖刺”（Rose, Bud, Thorn）破冰游戏。用户通过种下玫瑰来分享感恩、焦虑和期待，形成一个随时间生长的温暖社区花圃。

[English](README.md) | **线上试用：** [https://roselet-web.vercel.app](https://roselet-web.vercel.app)

## 当前项目位置

- 当前阶段：`Beta 已上线`
- 线上地址：[https://roselet-web.vercel.app](https://roselet-web.vercel.app)
- 当前判断：`Web 端核心产品已可公开试用，正在收集真实用户反馈`

### 进度概览

```text
总体进度        [########--] 75%
产品功能        [#########-] 90%
工程质量        [#########-] 90%
生产部署        [##########] 98%
小程序落地      [#####-----] 50%
真实用户验证    [##--------] 20%
```

### 当前生产架构

- **Web 前端**：Vercel — [https://roselet-web.vercel.app](https://roselet-web.vercel.app)
- **Rust 后端**：AWS Lightsail（Docker + Axum）
- **数据库**：Docker PostgreSQL on Lightsail
- **HTTPS**：Caddy + `roselet.47.131.238.0.sslip.io` 临时域名
- **自动部署**：GitHub Actions 构建 GHCR 镜像 → SSH 部署到 Lightsail

详细部署文档：[docs/AWS_LIGHTSAIL_DEPLOYMENT.md](docs/AWS_LIGHTSAIL_DEPLOYMENT.md)

### 接下来几个小目标

1. 收集真实用户试用反馈。
2. 观察 `/stats` 后台数据，判断是否接近 100 用户目标线。
3. 补齐小程序真机闭环。
4. 后续考虑正式域名、备份、监控。

### 历史方案

早期曾评估 Cloudflare / Render / Neon 等免费/无绑卡方案，相关文档已标为历史参考，不再维护。当前生产主线为 AWS Lightsail。

## 游戏规则

| 图标 | 名称 | 含义 |
|------|------|------|
| 🌹 | **玫瑰** | 这周让你感到幸福或感恩的事情是什么？ |
| 🌵 | **尖刺** | 现在有什么让你感到焦虑或需要帮助的事情吗？ |
| 🌱 | **花苞** | 你现在有什么期待？这周有什么新灵感想要实现呢？ |

## 功能特性

- 🌹 **种花** — 选择颜色（红/白/黄），填写玫瑰/尖刺/花苞中的任意组合
- 🏡 **花圃** — 浏览所有玫瑰，支持颜色筛选和 WebSocket 实时更新
- 🔐 **认证** — 昵称注册 + JWT 鉴权；种花和点赞需要登录
- ❤️ **点赞** — 对有共鸣的玫瑰表达支持
- ✏️ **管理** — 编辑或删除自己种下的玫瑰
- 🤖 **AI 回复** — 种花后后台异步生成个性化 AI 回复（兼容 OpenAI API）
- 🧠 **WASM 推荐** — 基于 Rust → WASM 的客户端智能内容推荐（112KB）
- 🎵 **音效** — Tone.js 合成器：种植/点赞/通知音效 + 背景音乐
- 🌌 **动态背景** — 跟随真实时间变化的日夜渐变（凌晨深夜星空 → 黎明橙紫 → 白天墨绿 → 傍晚玫瑰 → 入夜紫粉）
- ✨ **烟花特效** — 种花成功时的粒子爆炸动画
- 👤 **个人资料** — 个人花圃 + 种花统计
- 📖 **Swagger** — 可交互 API 文档，访问 `/swagger`
- 🐳 **Docker** — Docker Compose 一键部署

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Rust 1.85+ / Axum / SQLx / PostgreSQL |
| 前端 | Next.js 16 / Tailwind CSS / shadcn UI |
| 实时 | WebSocket（tokio broadcast） |
| 认证 | JWT（jsonwebtoken v9） |
| AI | OpenAI 兼容 API（异步非阻塞） |
| WASM | Rust → wasm-bindgen → wasm-pack（112KB） |
| 音效 | Tone.js 合成器 |
| 部署 | Vercel + AWS Lightsail + Docker + Caddy |

## 快速开始

### 线上试用

直接访问：[https://roselet-web.vercel.app](https://roselet-web.vercel.app)

界面截图见 [docs/screenshots/](docs/screenshots/)。

### 环境要求

- Rust 1.85+（stable）
- Node.js 22+
- pnpm
- PostgreSQL 16+

### 安装

```bash
git clone https://github.com/qiaopengjun5162/roselet.git
cd roselet
just db-init    # 创建数据库 + 运行迁移
just dev        # 启动后端（3001）+ 前端（3000）
```

### 常用命令

```bash
just dev           # 启动开发环境
just test          # 运行所有测试（461 个）
just check-all     # 格式化 + 静态分析 + 审计 + 测试
just pre-commit    # 提交前检查
just db-reset      # 重置数据库
just wasm          # 构建 WASM 推荐模块
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgres://localhost/roselet` | PostgreSQL 连接字符串 |
| `JWT_SECRET` | — | JWT 签名密钥（生产环境必填） |
| `PORT` | `3001` | 后端端口 |
| `OPENAI_API_KEY` | — | AI 回复密钥（可选，缺省时跳过） |
| `OPENAI_BASE_URL` | — | OpenAI 兼容 API 地址 |
| `OPENAI_MODEL` | — | 模型名称 |

### Docker 本地部署

```bash
docker-compose up --build
```

### 生产部署

当前生产环境使用 `Vercel Web + AWS Lightsail Rust backend + Docker Postgres + Caddy HTTPS`，详见 [docs/AWS_LIGHTSAIL_DEPLOYMENT.md](docs/AWS_LIGHTSAIL_DEPLOYMENT.md)。

## API 列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查（数据库连通性 + 版本） |
| POST | `/api/auth/register` | 昵称注册/登录 → JWT |
| GET | `/api/user/profile` | 用户资料 + 统计（需 JWT） |
| POST | `/api/rose` | 种一朵玫瑰（需 JWT） |
| PUT | `/api/rose/:id` | 编辑玫瑰（仅创建者） |
| DELETE | `/api/rose/:id` | 删除玫瑰（仅创建者） |
| GET | `/api/rose/:id` | 获取单朵玫瑰 |
| POST | `/api/rose/:id/like` | 点赞/取消点赞（需 JWT） |
| GET | `/api/garden` | 花圃列表（分页，可筛选颜色） |
| GET | `/api/my/roses` | 我的花圃（需 JWT，分页） |
| GET | `/api/ws` | WebSocket 实时推送 |
| GET | `/swagger` | Swagger UI（OpenAPI 3.0） |

## 项目结构

```
roselet/
├── apps/web/                   # Next.js 前端
│   └── src/
│       ├── app/
│       │   ├── page.tsx        # 首页（规则介绍 + 入口）
│       │   ├── plant/          # 种花页（需登录）
│       │   ├── garden/         # 花圃（筛选 + 实时更新）
│       │   ├── rose/[id]/      # 玫瑰详情（编辑/删除/点赞）
│       │   ├── my/             # 我的花圃
│       │   ├── profile/        # 个人资料 + 统计
│       │   └── login/          # 登录/注册
│       ├── components/
│       │   ├── rose-card.tsx   # 通用玫瑰卡片（毛玻璃深色主题）
│       │   ├── fireworks.tsx   # 种花成功粒子动画
│       │   ├── day-night-bg.tsx# 日夜动态背景
│       │   └── nav.tsx         # 导航栏
│       └── lib/
│           ├── api.ts          # API 客户端
│           ├── sound.ts        # Tone.js 音效系统
│           ├── ws.ts           # WebSocket 客户端
│           └── recommend.ts    # WASM 加载器
├── crates/
│   ├── backend/                # Rust Axum 后端
│   │   ├── src/
│   │   │   ├── routes/         # API 处理器
│   │   │   ├── models/         # 数据模型
│   │   │   ├── auth.rs         # JWT 认证
│   │   │   ├── ai.rs           # AI 回复生成
│   │   │   └── state.rs        # 应用状态
│   │   └── migrations/         # SQL 迁移
│   └── recommend/              # Rust WASM 推荐模块
├── justfile                    # 任务自动化
└── Cargo.toml                  # Rust workspace
```

## 测试

| 套件 | 数量 | 命令 |
|------|------|------|
| 后端集成 + 单元 | 110 | `cargo nextest run --workspace --all-features -j1` |
| Rust WASM/推荐 | 139 | 含于上方 |
| Web 前端 | 146 | `pnpm --filter @roselet/web test` |
| 小程序 | 66 | `pnpm --filter @roselet/miniprogram test` |
| **总计** | **461** | `just test` |

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
