# AGENTS.md - Roselet

> 新会话开始时，先读 `DEVLOG.md` 了解上次进度。

这是 Codex 的项目入口文件。完整项目规则、架构约束、命令速查和测试状态以 `CLAUDE.md` 为共享源，避免两份长文档重复维护后漂移。

## 必须遵守
- 业务逻辑优先放进 `crates/recommend/src/` 的 Rust WASM 层；TS 只保留平台调用和 UI 渲染。
- 修改后按风险运行对应检查；Rust 测试使用 `cargo-nextest`。
- 前端/小程序覆盖率门禁使用 `just coverage` 或根目录 `pnpm test:coverage`。
- 质量门禁使用 `just typecheck`、`just lint`、`just audit`、`just next-build`；`just check-all` / `just pre-commit` 已包含这些检查。
- 每次代码或项目文档变更都要 commit 并 push。
- 遇到问题先解决；解决后把问题、原因、处理方式、验证命令记录到 `DEVLOG.md`。
- 发现新的非显然约束时，同时更新 `DEVLOG.md` 和共享项目文档。
