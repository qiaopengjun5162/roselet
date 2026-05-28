# Roselet 开发日志

> 每次会话结束时更新此文件，确保下次会话能无缝衔接。

---

## 2026-05-27 会话 #1

### 会话目标
搭建 Roselet 全栈项目 + 应用 rust-dev-workflow 开发规范

### 完成的工作

#### 项目初始化
- 创建 Rust workspace + Axum 后端（crates/backend/）
- 创建 Next.js 15 前端（apps/web/）+ shadcn UI
- pnpm monorepo 结构
- PostgreSQL 数据库 + SQLx 迁移
- GitHub 仓库创建并推送：https://github.com/qiaopengjun5162/roselet

#### 后端实现
- POST /api/rose — 创建玫瑰（含输入验证）
- GET /api/garden — 获取花圃所有玫瑰
- GET /api/rose/:id — 获取单朵玫瑰
- thiserror 错误处理（替代 anyhow），404/400/500 正确区分
- CORS 配置允许前端调用
- 8 个集成测试全部通过

#### 前端实现
- 首页：规则介绍 + "种一朵玫瑰"按钮
- 种花页：选颜色（红/白/黄）+ 表单 + 验证
- 花圃页：展示所有玫瑰（含 loading/error/empty 状态）
- 导航栏 + 响应式布局
- 6 个单元测试

#### 开发工具链（从 rust-template 借鉴）
- justfile 任务自动化（dev/build/test/check-all/pre-commit/db-init/db-reset）
- rustfmt + taplo 格式化
- clippy 静态分析
- cargo-deny 依赖审计
- typos 拼写检查
- git-cliff CHANGELOG 生成
- .pre-commit-config.yaml
- GitHub Actions CI/CD（含 PostgreSQL service）
- release profile（LTO + strip）

#### 文档
- CLAUDE.md — 项目文档 + 命令速查
- PROGRESS.md — 功能进度追踪
- CONTRIBUTING.md — 贡献指南
- LICENSE — MIT 许可证
- DEVLOG.md — 本文件

### 关键决策
- 错误处理：anyhow → thiserror（结构化错误类型，HTTP 状态码正确映射）
- 测试运行器：cargo-nextest（非 cargo test）
- 测试串行执行：`--test-threads=1`（共享数据库状态）
- Commit 规范：Conventional Commits（feat/fix/docs/refactor/test/chore）

### 当前状态
- 所有代码已提交并推送到 main 分支
- 后端编译通过，8 个测试通过
- 前端构建通过，6 个测试通过
- CI/CD 已配置（GitHub Actions）

### 待办事项
- [ ] 花圃分页加载
- [ ] 玫瑰详情页
- [ ] 实时更新（WebSocket）
- [ ] 用户认证
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

---

## 2026-05-28 会话 #2

### 会话目标
继续实现待办功能：花圃分页加载 + 玫瑰详情页

### 完成的工作

#### 后端：花圃分页 API
- 新增 `models/pagination.rs`：`Pagination`（查询参数）+ `PaginatedResponse<T>`（响应结构）
- `GET /api/garden` 支持 `?page=&per_page=` 查询参数
- SQL 添加 `LIMIT/OFFSET` + `COUNT(*)` 总数查询
- 新增分页集成测试（9 个测试全部通过）

#### 前端：花圃分页 + 详情页
- `api.ts`：`getGarden` 适配分页响应，添加 `page`/`perPage` 参数
- 花圃页：显示总数、"加载更多"按钮、卡片链接到详情页
- 新增 `/rose/[id]` 详情页：展示玫瑰完整信息（感恩/焦虑/期待）
- 测试更新：7 个前端测试全部通过

#### 工具链修复
- `.rustfmt.toml`：移除 5 个 nightly-only 选项，消除格式化警告
- `cargo fmt` 自动修复格式差异

### 当前状态
- 后端 9 个测试通过，前端 7 个测试通过
- clippy + fmt 检查干净
- 已提交并推送到 main

### 待办事项
- [ ] 实时更新（WebSocket）
- [ ] 用户认证
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

---

## 2026-05-28 会话 #3

### 会话目标
实现 WebSocket 实时更新

### 完成的工作

#### 后端：WebSocket 实时广播
- 新增 `state.rs`：`AppState` 持有 PgPool + `broadcast::Sender<Rose>`
- 新增 `routes/ws.rs`：`GET /api/ws` WebSocket 端点，订阅广播频道
- `routes/rose.rs`：创建玫瑰后通过 `rose_tx.send()` 广播
- `Rose` 模型添加 `Clone` derive 支持广播
- 所有路由从 `State<PgPool>` 迁移到 `State<AppState>`

#### 前端：实时接收新玫瑰
- 新增 `lib/ws.ts`：WebSocket 客户端工具函数
- 花圃页连接 WebSocket，新玫瑰自动插入列表顶部

#### 依赖更新
- axum 添加 `ws` feature 启用 WebSocket
- 添加 `futures-util` 依赖（SinkExt + StreamExt）
- `cargo update` 更新 Cargo.lock

### 当前状态
- 后端 9 个测试通过，前端 7 个测试通过
- clippy + fmt 检查干净
- 已提交并推送到 main

### 待办事项
- [ ] 用户认证
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

---

<!-- 下次会话在此处继续记录 -->
