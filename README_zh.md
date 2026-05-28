# Roselet

![Rust](https://img.shields.io/badge/Rust-1.88.0-orange?logo=rust)
![License](https://img.shields.io/badge/License-MIT-blue)

社区破冰互动 Web 应用：种下玫瑰（感恩）、花苞（期待）、尖刺（焦虑），形成社区花圃。

[English](README.md)

## 技术栈

- 后端：Rust 1.85+ / Axum / SQLx / PostgreSQL
- 前端：Next.js 15 + shadcn UI + Tailwind CSS
- 实时推送：WebSocket（tokio broadcast）
- 用户认证：JWT（jsonwebtoken）

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
just test          # 运行所有测试
just check-all     # 格式化 + 静态分析 + 审计 + 测试
just pre-commit    # 提交前检查
just db-reset      # 重置数据库
```

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册（昵称 → 令牌） |
| GET | `/api/user/profile` | 获取用户资料 + 统计（需令牌） |
| POST | `/api/rose` | 种一朵玫瑰 |
| PUT | `/api/rose/:id` | 编辑玫瑰（仅创建者） |
| DELETE | `/api/rose/:id` | 删除玫瑰（仅创建者） |
| GET | `/api/rose/:id` | 获取单朵玫瑰 |
| POST | `/api/rose/:id/like` | 点赞 / 取消点赞（需令牌） |
| GET | `/api/garden?color=&page=&per_page=` | 获取花圃（分页，可筛选颜色） |
| GET | `/api/my/roses?page=&per_page=` | 获取我的花圃（需令牌） |
| GET | `/api/ws` | WebSocket 实时推送 |

## 项目结构

```
roselet/
├── apps/web/              # 前端
│   └── src/app/
│       ├── page.tsx       # 首页
│       ├── plant/         # 种花页
│       ├── garden/        # 花圃页（支持颜色筛选）
│       ├── rose/[id]/     # 玫瑰详情 + 点赞
│       ├── my/            # 我的花圃
│       ├── profile/       # 个人资料 + 统计
│       └── login/         # 登录页
├── crates/backend/        # 后端
│   ├── src/
│   │   ├── routes/        # 接口处理
│   │   ├── models/        # 数据模型
│   │   ├── auth.rs        # 用户认证
│   │   └── state.rs       # 应用状态
│   └── migrations/        # 数据库迁移
├── justfile               # 任务自动化
└── Cargo.toml             # 工作空间配置
```

## 贡献

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)（英文）。

## 许可证

[MIT](LICENSE)
