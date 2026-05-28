# Roselet

社区破冰互动 Web 应用：种下玫瑰（感恩）、花苞（期待）、尖刺（焦虑），形成社区花圃。

## 技术栈

- **后端**: Rust + Axum + SQLx + PostgreSQL
- **前端**: Next.js 15 + shadcn UI + Tailwind CSS
- **实时**: WebSocket (tokio broadcast)
- **认证**: JWT (jsonwebtoken)

## 快速开始

### 环境要求

- Rust (stable)
- Node.js 22+
- pnpm
- PostgreSQL 16+

### 安装

```bash
git clone https://github.com/qiaopengjun5162/roselet.git
cd roselet
just db-init    # 创建数据库 + 运行迁移
just dev        # 启动后端 (3001) + 前端 (3000)
```

### 常用命令

```bash
just dev           # 启动开发环境
just test          # 运行所有测试
just check-all     # 格式化 + lint + 审计 + 测试
just pre-commit    # 提交前检查
just db-reset      # 重置数据库
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册（nickname → JWT） |
| POST | `/api/rose` | 种一朵玫瑰 |
| GET | `/api/garden?page=&per_page=` | 获取花圃（分页） |
| GET | `/api/rose/:id` | 获取单朵玫瑰 |
| GET | `/api/ws` | WebSocket 实时推送 |

## 项目结构

```
roselet/
├── apps/web/              # Next.js 前端
│   └── src/app/
│       ├── page.tsx       # 首页
│       ├── plant/         # 种花页
│       ├── garden/        # 花圃页
│       ├── rose/[id]/     # 玫瑰详情
│       └── login/         # 登录页
├── crates/backend/        # Rust Axum 后端
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   ├── models/        # 数据模型
│   │   ├── auth.rs        # JWT 认证
│   │   └── state.rs       # 应用状态
│   └── migrations/        # SQL 迁移
├── justfile               # 任务自动化
└── Cargo.toml             # Rust workspace
```

## 贡献

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
