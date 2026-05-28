# Roselet

![Rust](https://img.shields.io/badge/Rust-1.88.0-orange?logo=rust)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![License](https://img.shields.io/badge/License-MIT-blue)

> 一起来种一个玫瑰花圃吧！

Roselet 是一个社区破冰互动 Web 应用，灵感来自经典的"玫瑰、花苞、尖刺"（Rose, Bud, Thorn）破冰游戏。参与者通过种下一朵玫瑰，分享自己的感恩、焦虑和期待，形成一个温暖的社区花圃。

[English](README.md)

## 游戏规则

| 图标 | 名称 | 含义 |
|------|------|------|
| 🌹 | **玫瑰** | 在社区的这一周，一件让你感到幸福或感恩的事情是什么？ |
| 🌵 | **尖刺** | 现在有什么让你感到焦虑或者需要帮助的事情吗？ |
| 🌱 | **花苞** | 你现在有什么期待的事情吗？这周有什么新灵感想要实现呢？ |

## 交互流程

### 第一步：了解规则

扫描二维码或打开链接，进入规则介绍页面。页面分别解释玫瑰、尖刺、花苞三个元素的含义，点击"种一朵玫瑰"按钮进入下一步。

### 第二步：种下一朵玫瑰

一朵精美的玫瑰呈现在眼前。你可以：
- **选择颜色**：红玫瑰（热情）、白玫瑰（纯洁）、黄玫瑰（温暖）
- **填写内容**：在花瓣、花苞、尖刺上分别点击，弹出对话框
  - 点开玫瑰 → 淡色字提示"一件让你感恩的事……"
  - 点开花苞 → 淡色字提示"你现在有什么期待……"
  - 点开尖刺 → 淡色字提示"有什么让你焦虑……"
  - 开始打字时提示文字自动消失
- 至少填写一项内容后，右下角亮起"种下玫瑰吧"按钮

### 第三步：种入花圃

一段动画展示你的玫瑰被种入社区花圃。各色玫瑰在花圃中绽放，旁边浮现一行文字："谢谢你在社区种下的玫瑰"。

你可以随时查看花圃中所有的玫瑰，了解社区成员的感恩、焦虑和期待，找到共鸣、互相支持。

## 功能特性

- 🌹 种花：选择颜色，分享感恩、焦虑、期待
- 🏡 花圃：浏览所有玫瑰，支持按颜色筛选
- 👤 用户：注册登录，查看个人花圃和资料
- ❤️ 互动：为玫瑰点赞，表达共鸣
- 🔔 实时：WebSocket 推送，新玫瑰即时出现在花圃
- ✏️ 管理：编辑或删除自己种的玫瑰

## 技术栈

- **后端**：Rust 1.85+ / Axum / SQLx / PostgreSQL
- **前端**：Next.js 15 + shadcn UI + Tailwind CSS
- **实时推送**：WebSocket（tokio broadcast）
- **用户认证**：JWT（jsonwebtoken）

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
just test          # 运行所有测试（36 后端 + 12 前端）
just check-all     # 格式化 + 静态分析 + 审计 + 测试
just pre-commit    # 提交前检查
just db-reset      # 重置数据库
```

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册（昵称 → JWT） |
| GET | `/api/user/profile` | 获取用户资料 + 统计（需 JWT） |
| POST | `/api/rose` | 种一朵玫瑰 |
| PUT | `/api/rose/:id` | 编辑玫瑰（仅创建者） |
| DELETE | `/api/rose/:id` | 删除玫瑰（仅创建者） |
| GET | `/api/rose/:id` | 获取单朵玫瑰 |
| POST | `/api/rose/:id/like` | 点赞 / 取消点赞（需 JWT） |
| GET | `/api/garden?color=&page=&per_page=` | 获取花圃（分页，可筛选颜色） |
| GET | `/api/my/roses?page=&per_page=` | 获取我的花圃（需 JWT） |
| GET | `/api/ws` | WebSocket 实时推送 |

## 项目结构

```
roselet/
├── apps/web/              # Next.js 前端
│   └── src/app/
│       ├── page.tsx       # 首页（规则介绍）
│       ├── plant/         # 种花页
│       ├── garden/        # 花圃页（颜色筛选 + 实时更新）
│       ├── rose/[id]/     # 玫瑰详情（编辑/删除/点赞）
│       ├── my/            # 我的花圃
│       ├── profile/       # 个人资料 + 统计
│       └── login/         # 登录页
├── crates/backend/        # Rust Axum 后端
│   ├── src/
│   │   ├── routes/        # API 处理器
│   │   ├── models/        # 数据模型
│   │   ├── auth.rs        # JWT 认证
│   │   └── state.rs       # 应用状态（数据库 + 广播）
│   └── migrations/        # SQL 迁移
├── justfile               # 任务自动化
└── Cargo.toml             # Rust workspace
```

## 贡献

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)（英文）。

## 许可证

[MIT](LICENSE)
