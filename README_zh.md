# Roselet

![Rust](https://img.shields.io/badge/Rust-1.88.0-orange?logo=rust)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![License](https://img.shields.io/badge/License-MIT-blue)

> 种下一朵玫瑰，分享你的情绪，等待宇宙的回响。

Roselet 是一个社区破冰互动 Web 应用，灵感来自经典的"玫瑰、花苞、尖刺"（Rose, Bud, Thorn）破冰游戏。用户通过种下玫瑰来分享感恩、焦虑和期待，形成一个随时间生长的温暖社区花圃。

[English](README.md)

## 当前项目位置

- 当前阶段：`Beta 准备上线`
- 当前判断：`核心产品已经完成，工程质量也基本到位，当前重点不再是“补功能”，而是“上线、试用、验证”`

### 进度概览

```text
总体进度        [########--] 75%
产品功能        [#########-] 90%
工程质量        [#########-] 90%
生产部署        [###-------] 30%
小程序落地      [#####-----] 50%
真实用户验证    [#---------] 10%
```

### 当前目标

1. 先把 Web 端稳定上线，能给别人直接访问和体验。
2. 再补齐小程序登录与真机闭环。
3. 最后通过真实用户试用，验证这个产品是否值得继续扩展。

### 接下来几个小目标

1. 明确 Cloudflare 路线：哪些能直接上，哪些需要改造。
2. 固化部署方案：前端、API、数据库、WebSocket、AI 分别怎么放。
3. 跑通第一版外网环境，完成基础冒烟验证。

### 下一步要做什么

下一步会先完成一份正式的 Cloudflare 部署路线图，把“最终目标、阶段目标、当前阻塞、落地顺序”写清楚，再按最小可行路径推进上线。

### 关于 Cloudflare

当前判断是：`能上，但不建议把当前 Rust 后端原封不动塞进单个 Worker`。

更合适的路径是：

1. 先把 Next.js Web 端部署到 Cloudflare
2. 后端暂时保留独立服务
3. 再按阶段评估是否把 API / 实时能力迁到 Cloudflare 原生能力

详细见 [docs/CLOUDFLARE_DEPLOYMENT_ROADMAP.md](docs/CLOUDFLARE_DEPLOYMENT_ROADMAP.md)。

### 当前最低成本推荐

如果以“最快上线 + 最少改造 + 充分利用免费资源”为目标，当前更推荐：

1. 主应用 Web：`Vercel`
2. 后端：保留现有 Rust 服务
3. 数据库：保留现有 PostgreSQL
4. 文档/介绍页：`GitHub Pages`

详细对比见 [docs/DEPLOYMENT_OPTIONS_COMPARISON.md](docs/DEPLOYMENT_OPTIONS_COMPARISON.md)。

### 当前免费方案

如果现在明确目标是“**不买服务器，先走免费方案**”，我当前推荐：

1. Web：`Vercel Hobby`
2. 后端：`Render Free`
3. 数据库：`Neon Free`
4. 文档页：`GitHub Pages`

详细见 [docs/FREE_DEPLOYMENT_PLAN.md](docs/FREE_DEPLOYMENT_PLAN.md)。

如果要直接开干，按这份清单走：

- [docs/FREE_DEPLOYMENT_CHECKLIST.md](docs/FREE_DEPLOYMENT_CHECKLIST.md)

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
| 部署 | Docker Compose |

## 快速开始

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
just test          # 运行所有测试（72 后端 + 20 前端）
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

### Docker 部署

```bash
docker-compose up --build
```

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
| 后端集成测试 | 36 | `cargo nextest run -j1` |
| 后端单元测试 | 36 | 含于上方 |
| 前端单元测试 | 20 | `pnpm test` |

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
