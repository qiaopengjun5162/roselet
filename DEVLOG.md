# Roselet 开发日志

> 每次会话结束时更新此文件，确保下次会话能无缝衔接。

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

## 2026-05-28 会话 #4

### 会话目标
修复 CI/CD 失败 + 实现后端用户认证

### 完成的工作

#### CI/CD 修复
- 后端 workflow 添加 `cargo install cargo-nextest --locked` 步骤
- 测试命令从 `-- --test-threads=1` 改为 `-j1`
- 根 `package.json` 添加 `packageManager: "pnpm@11.3.0"` 解决 pnpm 版本未指定问题

#### 后端：用户认证
- 新增 `auth.rs`：JWT token 创建/验证（jsonwebtoken v9）
- 新增 `models/user.rs`：User 模型 + RegisterRequest + AuthResponse
- 新增 `routes/auth.rs`：`POST /api/auth/register`（nickname 唯一，ON CONFLICT upsert）
- 新增 `migrations/002_create_user.sql`：users 表 + roses 表添加 user_id 外键
- `routes/rose.rs`：创建玫瑰时提取可选 user_id（Bearer token）
- 11 个后端集成测试全部通过

### 当前状态
- 已提交并推送到 main
- 后端认证完整，前端认证页面待实现

### 待办事项
- [ ] 前端登录/注册页面
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

<!-- 下次会话在此处继续记录 -->

## 2026-05-28 会话 #5

### 会话目标
CI/CD 修复 + 前端登录页 + 文档规范化

### 完成的工作

#### CI/CD 修复
- workflow 添加 cargo-nextest 安装步骤
- pnpm 降级到 9.15.4 兼容 Node 20
- lockfile 从 apps/web 移到 workspace 根目录
- 根 package.json 添加 test 脚本

#### 前端认证
- 登录页（/login）：昵称输入 + JWT 存储
- api.ts 增加 auth 辅助函数（getToken/setToken/getUser/setUser/logout）
- createRose 自动携带 Authorization 头
- 导航栏 Nav 客户端组件：登录状态 + 昵称 + 登出

#### 文档
- README.md（英文）+ README_zh.md（中文）
- CONTRIBUTING.md 改为英文

### 当前状态
- 18 个后端测试通过
- CI/CD 全部通过

## 2026-05-28 会话 #6

### 会话目标
补测试 + 实现玫瑰编辑/删除

### 完成的工作

#### 测试补充（18 → 24）
- WebSocket 实时推送验证
- JWT 认证流程（带 token / 不带 token）
- 重复昵称注册
- 分页边界值（page=0, per_page=0/200）
- 非法 UUID / 畸形 JSON

#### 玫瑰编辑/删除
- PUT /api/rose/:id（仅 owner）
- DELETE /api/rose/:id（仅 owner）
- Forbidden (403) 错误类型
- 前端详情页：编辑按钮（内联表单）+ 删除按钮（确认对话框）
- 6 个新测试：owner 编辑、他人被拒、未认证被拒、owner 删除、他人删除被拒、删除后 404

#### 前端测试补充（7 → 12）
- updateRose / deleteRose 测试
- createRose auth header 测试
- Rose 接口增加 user_id 字段

### 当前状态
- 24 个后端测试 + 12 个前端测试全过
- clippy + fmt 干净
- 已提交并推送到 main

### 待办事项
- [ ] 用户个人花圃
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

<!-- 下次会话在此处继续记录 -->

## 2026-05-28 会话 #7

### 会话目标
实现用户个人花圃 + 消除 unwrap()

### 完成的工作

#### 后端：个人花圃 API
- 新增 `routes/my.rs`：`GET /api/my/roses`（需 JWT 认证，按 user_id 过滤，分页）
- `routes/mod.rs` 注册 my 模块
- `main.rs` 注册 `/api/my/roses` 路由
- 4 个新集成测试：未认证被拒、只显示自己的玫瑰、空花圃、分页

#### 消除 unwrap()
- `auth.rs`：`create_token` 返回 `Result<String, AppError>`（不再 expect）
- `error.rs`：新增 `AppError::Auth(String)` 变体
- `routes/auth.rs`：`create_token` 调用添加 `?` 传播错误
- `main.rs`：`main()` 返回 `Result<(), Box<dyn Error>>`，所有 unwrap/expect 替换为 `?`

#### 前端：个人花圃
- `api.ts`：新增 `getMyRoses()` 函数
- 新增 `/my` 页面：展示当前用户玫瑰列表（分页 + 空状态 + 未登录跳转）
- `nav.tsx`：登录状态下显示"我的花圃"链接

### 当前状态
- 28 个后端测试 + 12 个前端测试全过
- clippy + fmt 干净
- 后端源码无 unwrap()（仅保留安全的 unwrap_or）

### 待办事项
- [ ] 花圃按颜色筛选
- [ ] 用户个人资料页
- [ ] 点赞/反应功能
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

<!-- 下次会话在此处继续记录 -->

## 2026-05-28 会话 #10

### 会话目标
实现用户个人资料页

### 完成的工作

#### 后端：用户资料 API
- `routes/auth.rs`：新增 `GET /api/user/profile` 端点
- 返回用户信息 + 种花统计（总数、红/白/黄各颜色数量）
- 需 JWT 认证

#### 前端：资料页
- 新增 `/profile` 页面：显示昵称、注册时间、种花统计（总数 + 颜色分布）
- `api.ts`：新增 `UserProfile` 接口和 `getUserProfile()` 函数
- `nav.tsx`：登录状态下显示"资料"链接
- 2 个新集成测试：正常获取 + 未认证被拒

### 当前状态
- 33 个后端测试 + 12 个前端测试全过
- clippy + fmt 干净

### 待办事项
- [ ] 点赞/反应功能
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

<!-- 下次会话在此处继续记录 -->

## 2026-05-28 会话 #9

### 会话目标
花圃按颜色筛选

### 完成的工作

#### 后端：颜色筛选
- `routes/garden.rs`：新增 `GardenQuery` 结构体（含 `color: Option<String>`）
- 按颜色筛选时验证颜色有效性，无效返回 400
- SQL 查询动态添加 `WHERE color = $1` 条件

#### 前端：筛选按钮
- `api.ts`：`getGarden` 新增可选 `color` 参数
- `garden/page.tsx`：新增红/白/黄/全部筛选按钮，切换时自动重新加载
- 1 个新集成测试：验证颜色筛选和无效颜色

### 当前状态
- 31 个后端测试 + 12 个前端测试全过
- clippy + fmt 干净

### 待办事项
- [ ] 用户个人资料页
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

<!-- 下次会话在此处继续记录 -->

## 2026-05-28 会话 #8

### 会话目标
玫瑰显示种植者昵称

### 完成的工作

#### 后端：昵称关联
- 新增 `RoseResponse` 结构体（含 `nickname: Option<String>` 字段）
- `routes/mod.rs` 新增 `resolve_nicknames` 辅助函数（批量查询用户昵称）
- 所有玫瑰 API 返回 `RoseResponse`（含昵称）
- WebSocket 广播也改为 `RoseResponse`
- 2 个新集成测试：玫瑰包含昵称、花圃匿名/注册用户区分

#### 前端：显示昵称
- `api.ts`：`Rose` 接口新增 `nickname` 字段
- 花圃卡片和详情页显示种植者昵称

### 当前状态
- 30 个后端测试 + 12 个前端测试全过
- clippy + fmt 干净

### 待办事项
- [ ] 花圃按颜色筛选
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

<!-- 下次会话在此处继续记录 -->

## 2026-05-28 会话 #9

### 会话目标
花圃按颜色筛选 + 用户资料页 + 点赞功能

### 完成的工作

#### 花圃颜色筛选
- 后端：`GET /api/garden?color=red/white/yellow` 支持按颜色筛选
- 前端：花园页面新增红/白/黄/全部筛选按钮
- 1 个新集成测试

#### 用户资料页
- 后端：`GET /api/user/profile` 返回用户信息 + 种花统计
- 前端：`/profile` 页面显示昵称、注册时间、颜色分布统计
- 导航栏新增"资料"链接
- 2 个新集成测试

#### 点赞功能
- 新增 `likes` 表（user_id, rose_id, UNIQUE 约束）
- 后端：`POST /api/rose/:id/like` 切换点赞（需 JWT）
- `RoseResponse` 新增 `like_count` 字段
- 前端：详情页点赞按钮、花圃卡片显示点赞数
- 3 个新集成测试

### 当前状态
- 36 个后端测试 + 12 个前端测试全过
- clippy + fmt 干净

### 待办事项
- [ ] 小程序适配（未来）
- [ ] WASM AI 模块（未来）
- [ ] Web3 功能（未来）

<!-- 下次会话在此处继续记录 -->
