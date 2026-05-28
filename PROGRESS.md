# Roselet 开发进度

## 已完成

### 基础架构
- [x] Rust workspace + Axum 后端框架
- [x] Next.js 15 前端 + shadcn UI
- [x] pnpm monorepo 结构
- [x] PostgreSQL 数据库 + SQLx 迁移
- [x] GitHub Actions CI/CD

### 后端功能
- [x] POST /api/rose - 创建玫瑰
- [x] GET /api/garden - 获取花圃（分页）
- [x] GET /api/rose/:id - 获取单朵玫瑰
- [x] PUT /api/rose/:id - 编辑玫瑰（仅创建者）
- [x] DELETE /api/rose/:id - 删除玫瑰（仅创建者）
- [x] POST /api/auth/register - 用户注册（JWT）
- [x] GET /api/my/roses - 获取个人花圃（需 JWT，分页）
- [x] GET /api/ws - WebSocket 实时推送
- [x] 输入验证（颜色、字段长度、至少一个字段）
- [x] thiserror 错误处理（404/400/403/500 区分）
- [x] CORS 配置
- [x] JWT 认证（jsonwebtoken v9）

### 前端功能
- [x] 首页：规则介绍 + "种一朵玫瑰"按钮
- [x] 种花页：选颜色 + 表单 + 验证
- [x] 花圃页：分页加载 + 卡片展示 + WebSocket 实时更新 + 颜色筛选
- [x] 玫瑰详情页：/rose/[id] + 编辑/删除（owner）
- [x] 登录页：昵称注册 + JWT 存储
- [x] 导航栏：登录状态 + 昵称显示 + 登出 + 我的花圃链接
- [x] 个人花圃页：/my + 只显示自己的玫瑰
- [x] 响应式布局

### 测试
- [x] 31 个后端集成测试
- [x] 12 个前端单元测试

### 文档
- [x] README.md（英文）+ README_zh.md（中文）
- [x] CONTRIBUTING.md（英文）
- [x] CLAUDE.md / DEVLOG.md / PROGRESS.md

## 待办

- [ ] 用户个人资料页
- [ ] 小程序适配
- [ ] WASM AI 模块
- [ ] Web3 功能
