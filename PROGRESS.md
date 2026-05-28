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
- [x] 输入验证（颜色、字段长度、至少一个字段）
- [x] thiserror 错误处理（404/400/500 区分）
- [x] CORS 配置

### 前端功能
- [x] 首页：规则介绍 + "种一朵玫瑰"按钮
- [x] 种花页：选颜色 + 表单 + 验证
- [x] 花圃页：分页加载 + 卡片展示
- [x] 玫瑰详情页：/rose/[id]
- [x] 导航栏 + 响应式布局

### 开发工具链
- [x] justfile 任务自动化
- [x] rustfmt + taplo 格式化
- [x] clippy 静态分析
- [x] cargo-deny 依赖审计
- [x] typos 拼写检查
- [x] git-cliff CHANGELOG 生成
- [x] .pre-commit-config.yaml

### 测试
- [x] 9 个后端集成测试
- [x] 7 个前端单元测试

### 实时功能
- [x] WebSocket 实时广播新玫瑰

## 待办

- [ ] 用户认证
- [ ] 用户认证
- [ ] 小程序适配
- [ ] WASM AI 模块
- [ ] Web3 功能
