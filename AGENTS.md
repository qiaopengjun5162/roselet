# AGENTS.md - Roselet

> 新会话开始时，先读 `DEVLOG.md` 了解上次进度。

这是 Codex 的项目入口文件。完整项目规则、架构约束、命令速查和测试状态以 `CLAUDE.md` 为共享源，避免两份长文档重复维护后漂移。

## 必须遵守
- 业务逻辑优先放进 `crates/recommend/src/` 的 Rust WASM 层；TS 只保留平台调用和 UI 渲染。
- 跨端文案、本地化业务映射、日期/颜色/情绪/花语/AI prompt 等可测试 i18n 逻辑优先放 Rust WASM；不要让 Web 和小程序各维护一套。
- 音频策略也属于 Rust WASM：听一朵玫瑰 / 示波器试听等前景音频启动前，Web 只能调用统一 `prepareForegroundAudio()`，不要在组件里散落背景音乐开关判断。
- 乐观更新、缓存合并、状态冲突处理属于 Rust WASM；IndexedDB / wx storage 只负责平台持久化。
- 小程序 `createRose()` 发送 Rust `build_plant_body` 产出的 JSON 字符串；`request.ts` 必须原样传字符串 body，不能二次 `JSON.stringify`。
- 玫瑰种下后的正文内容不可修改，也暂不提供删除入口；`PUT /api/rose/{id}` 只做 owner 设置更新，目前仅允许公开转私密，或为「公开且未送礼」的玫瑰补填 `recipient_nickname` 完成送礼。
- 账号注销使用软删除：`deleted_at` 冷却 30 天内允许原昵称恢复；超过 30 天先匿名化旧账号再释放昵称，不能直接硬删用户和玫瑰。
- Web `logout()` 用 refresh token 调 `/api/auth/logout`；后端必须支持按 refresh token 撤销，不能只接受 access token。
- 如果目标是 `不绑卡上线`，后端迁移入口固定在 `apps/worker-api/`；不要再把 Render / Koyeb 当作默认免费后端方案。
- 当前实际生产后端路线已切到 AWS Lightsail：`https://roselet.47.131.238.0.sslip.io` 由 Caddy 反代到 Rust Axum `:3001`，`http://47.131.238.0` 只用于 IP 冒烟，操作手册见 `docs/AWS_LIGHTSAIL_DEPLOYMENT.md`。
- Vercel 生产前端必须使用 HTTPS API 基址和 `wss://` WebSocket，不能再配置 `http://47.131.238.0`，否则浏览器 mixed content 会拦截请求。
- Rust `/api/stats` 是管理员后台接口，生产必须在 Lightsail `.env.production` 配置 `ADMIN_USER_IDS`，不要把统计后台公开给所有登录用户。
- Lightsail 服务器上的 `.env.production`、数据库密码、JWT_SECRET、私钥不能写入 Git；文档只记录命令模板和公开地址。
- Lightsail 自动部署必须固定 Docker Compose project name 为 `roselet`，复用 `roselet_pgdata`；不要让 `deploy/lightsail/docker-compose.backend.yml` 默认生成 `lightsail_*` 容器和卷。
- `Deploy Backend` 只应在后端镜像相关路径变化或手动触发时部署；文档、Web、小程序变更不应重启生产 Rust 后端。
- 生产发布按 `docs/RELEASE_PROCESS.md` 执行；功能开发先走分支/预览/冒烟，不要把日常优化直接当作生产发布。
- 用户可见版本号以 Git tag / GitHub Release 为准，关于页展示的版本、commit、构建时间必须能追溯到发布记录。
- Worker 侧最小验证优先拆成独立的 `worker:typecheck` 和 `worker:test`，不要把 Cloudflare 类型环境和 Node 测试宿主强行混成一套。
- Worker 侧跨文件相对导入按 NodeNext/ESM 目标显式写 `.js` 扩展名，避免测试编译链和部署编译链分叉。
- 修改后按风险运行对应检查；Rust 测试使用 `cargo-nextest`。
- 前端/小程序覆盖率门禁使用 `just coverage` 或根目录 `pnpm test:coverage`。
- 质量门禁使用 `just typecheck`、`just lint`、`just audit`、`just next-build`；`just check-all` / `just pre-commit` 已包含这些检查。
- 每次代码或项目文档变更都要 commit 并 push。
- 遇到问题先解决；解决后把问题、原因、处理方式、验证命令记录到 `DEVLOG.md`。
- 可复用经验沉淀到 `docs/RUST_DEV_WORKFLOW_EXPERIENCE.md`，不要只留在会话记录里。
- 发现新的非显然约束时，同时更新 `DEVLOG.md` 和共享项目文档。
