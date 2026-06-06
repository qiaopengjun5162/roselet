# Rust Dev Workflow 经验总结

> 这份文档沉淀 Roselet 开发中遇到的问题、解决方式和可复用工作流。新增问题不要只写在聊天里，必须在这里留下可追踪记录。

## 目标

- 把一次性排障变成可复用经验。
- 把项目专有坑整理成通用 Rust / WASM / 全栈项目工作流。
- 为后续项目提供检查清单，而不是靠记忆重复踩坑。

## 核心经验

### 1. 先复用生产路由，再写测试

问题：测试路由和生产路由如果分别组装，很容易出现“测试通过但线上路由没注册”的漂移。

解决：后端统一暴露 `create_app(state)`，生产入口和集成测试都复用它。

通用规则：任何 Axum 项目都应让集成测试跑同一套路由装配函数，不要在测试里重新拼一个简化 Router。

### 2. 数据库测试必须可重复、可串行

问题：后端集成测试共享数据库时，`DELETE` 容易漏掉外键表，nextest 并发会互相清库。

解决：
- 清库使用 `TRUNCATE feedbacks, refresh_tokens, likes, roses, users RESTART IDENTITY CASCADE`。
- 数据库相关 nextest 使用 `-j1`。
- 本地代理环境下请求 localhost 加 `NO_PROXY=localhost,127.0.0.1`。

通用规则：有共享数据库状态的测试，要么每个测试独立 schema / transaction，要么显式串行并完整清理所有相关表。

### 3. SQLx 宏会在编译期访问数据库

问题：`sqlx::query!` / `query_scalar!` 编译期会连接数据库；沙箱或 CI 环境没准备好数据库时，Clippy / test 可能在编译阶段失败。

解决：
- 本地确保测试数据库可访问。
- 需要外部执行时明确说明原因。
- CI 在测试前先运行迁移。

通用规则：SQLx 项目要把“数据库可访问”视为编译门禁的一部分；如果要离线编译，必须维护 `.sqlx` 元数据。

### 4. 私密模式要按攻击面逐项验收

问题：只修创建或列表不够，私密数据可能从详情、点赞、WebSocket、个人列表、前端请求头等路径泄漏或访问失败。

解决：
- 公共花圃过滤 `is_private = false`。
- 私密详情仅 owner 可见，非 owner / 未登录返回 404。
- 非 owner 点赞私密玫瑰返回 404。
- 私密玫瑰不广播到公共 WebSocket。
- owner 详情返回真实 `like_count`。
- Web 和小程序详情请求都带 auth。

通用规则：隐私功能必须按“创建、读取、列表、变更、互动、实时推送、客户端请求头”全路径测试，不只测主流程。

### 5. Rust WASM 承担业务逻辑，TS 保持平台层

问题：Web / 小程序各写一套校验、颜色、推荐、粒子算法，会导致重复和分叉。

解决：将颜色元数据、表单校验、URL/body 构造、情绪分析、音频参数、花瓣/烟花粒子等下沉到 `crates/recommend/src/`。

通用规则：凡是能写 Rust 单元测试的业务逻辑，优先进入 Rust/WASM；TS 只处理 `fetch`、存储、Web Audio/Taro API 和渲染。

### 6. 覆盖率必须变成门禁

问题：覆盖率某次达到 90% 不等于以后会保持；CI 只跑普通测试时，覆盖率下降不会失败。

解决：
- Jest 配置 `coverageThreshold`。
- 根脚本 `pnpm test:coverage` 聚合 Web + 小程序。
- `just coverage` 和 CI 都跑 coverage。

通用规则：重要质量指标不要只记录数值，要转成可失败的门禁。

### 7. 质量门禁要覆盖构建链路

问题：只跑测试无法发现 TypeScript 类型、ESLint、依赖许可证、Next 生产构建问题。

解决：
- `pnpm typecheck`
- `pnpm lint`
- `cargo deny check`
- `cd apps/web && pnpm build`
- `just check-all` / `just pre-commit` 纳入这些命令。

通用规则：门禁至少覆盖格式化、静态分析、测试、依赖审计、生产构建；前端项目不能只跑 Jest。

### 8. 生成物要从 lint / test 索引中排除

问题：ESLint 和 Jest 会扫到 `.next`、coverage、Playwright cache、WASM 生成 JS / package metadata，产生误报或 haste collision。

解决：
- ESLint 忽略 `coverage/**`、`playwright/.cache/**`、`public/pkg/**`、`public/wasm/**`。
- Jest 忽略 `.next`、`playwright/.cache`、`public/wasm`。

通用规则：构建产物、测试缓存和生成代码不能进入源码 lint / Jest module crawl。

### 9. 网络和代理问题要写成命令

问题：`git push`、`cargo deny`、`pnpm` 在沙箱或代理环境下失败时，容易被误判为代码问题。

解决：
- GitHub 推送：`https_proxy=http://127.0.0.1:7890 git push origin main`
- cargo-deny：`https_proxy=http://127.0.0.1:7890 cargo deny check`
- localhost 测试：`NO_PROXY=localhost,127.0.0.1`
- pnpm 沙箱 fetch failed 时，按审批外部执行并复用已安装依赖。

通用规则：环境类问题要记录“可复制命令”，不要只写“代理有问题”。

### 10. cargo-deny 要维护许可证策略

问题：依赖使用 `BSD-3-Clause`、`ISC`、`Zlib` 等常见 OSI 许可证，workspace crate 未声明 license，会导致审计失败。

解决：
- Workspace crate 明确 `license = "MIT"`。
- `deny.toml` 只补充实际出现且可接受的许可证，不一把放宽。

通用规则：依赖审计失败时先看 license/advisory/source 分类；许可证白名单要收窄维护，并和项目 LICENSE 对齐。

### 11. Next build 不应依赖外部字体网络

问题：`next/font/google` 在受限网络下可能拖垮生产构建。

解决：移除 Google Fonts 构建期依赖，使用系统中文字体栈。

通用规则：生产构建应尽量自包含；外部网络资源应在运行时可降级，不能成为 build 必需条件。

### 12. WASM 绑定边界要避免宿主陷阱

问题：`wasm-bindgen` 不支持某些 Rust 签名，例如 `Option<&str>`；native test 中 `JsValue` 反序列化也可能因为没有 JS 宿主而 panic。

解决：
- 导出函数使用 `&str`，空字符串表示 None。
- native test 校验核心 Rust 数据结构；WASM 导出只做 smoke test。

通用规则：WASM 导出层保持薄，核心逻辑放在普通 Rust 函数中测试。

### 13. 虚拟 Cargo workspace 的门禁要显式覆盖 workspace

问题：根目录是虚拟 workspace 时，直接跑 `cargo clippy --all-targets ...` 的覆盖口径可能不够直观，容易误以为所有成员都检查了。

解决：质量门禁使用显式 workspace 命令：

```bash
cargo clippy --workspace --all-targets --all-features --tests --benches -- -D warnings
NO_PROXY=localhost,127.0.0.1 cargo nextest run --workspace --all-features --no-fail-fast
```

通用规则：多 crate 项目的门禁命令要把 `--workspace` 写出来，不依赖 Cargo 默认选择。

### 14. 前端异步测试要恢复默认 mock

问题：某个测试把 API mock 设置成永不 resolve 的 Promise，用于验证缓存首屏；如果 `beforeEach` 不恢复默认 resolvedValue，后续测试会一直停在 loading。

解决：所有共享 mock 在 `beforeEach` 中明确恢复默认行为；需要挂起 Promise 的测试只在单个用例里覆盖。

通用规则：测试可以制造“永不完成”的异步状态，但必须保证用例结束后不会污染下一条测试。

### 15. 401 和 403 不能混用

问题：后端把缺 token / token 过期返回 403，前端只在 401 时触发 refresh token，导致用户打开受保护页面时直接进入错误态。

解决：
- 缺 token、token 过期、token 无效返回 401。
- 已认证但资源 owner 不匹配返回 403。
- 需要隐藏私密资源存在性时返回 404。
- 前端在 401 后刷新 access token；刷新失败或没有 refresh token 时清理本地登录态并回登录页。

通用规则：认证失败用于“你是谁还没确认”，授权失败用于“你是谁已确认但权限不够”；状态码语义会直接影响客户端恢复流程。

## 更新规则

每次遇到问题，按这个顺序更新：

1. 先修复问题，不留下半成品。
2. 在 `DEVLOG.md` 记录当次上下文：
   - 问题现象
   - 根因判断
   - 解决方式
   - 验证命令和结果
3. 如果问题有复用价值，把经验提炼到本文档：
   - 不写流水账，写可迁移规则。
   - 优先描述“为什么会出问题”和“以后如何避免”。
   - 命令必须可复制。
4. 如果是会反复影响新会话的约束，同步到：
   - `AGENTS.md`：Codex 必须遵守的短规则。
   - `CLAUDE.md`：共享项目文档、命令、已知坑。
   - `PROGRESS.md`：项目进度或门禁状态。
5. 跑对应验证。
6. commit + push。

## 记录模板

```md
### 经验标题

问题：描述具体失败现象，包含关键错误信息。

根因：说明为什么会失败，不只贴报错。

解决：列出实际修改和命令。

验证：列出跑过的命令和结果。

通用规则：提炼成以后项目也适用的一句话。
```

## 何时升级到通用 Rust Dev Workflow

满足任意条件，就应考虑把经验从 Roselet 项目文档提炼到通用 `rust-dev-workflow`：

- 同类问题在两个以上 Rust 项目中出现。
- 经验不依赖 Roselet 业务背景。
- 能变成通用命令、模板配置或 checklist。
- 能减少新项目初始化或 CI/CD 排障成本。

升级时按这个粒度总结：

- **原则**：一句话说明为什么要这样做。
- **默认配置**：给出推荐的 `Cargo.toml` / `deny.toml` / `justfile` / workflow 片段。
- **验证命令**：给出最小可跑命令。
- **反例**：说明常见错误配置会导致什么问题。
