# Tauri App Spike

## 当前结论

Roselet 可以探索 Tauri，但现阶段不建议马上产品化。更稳的做法是先做 Spike，验证复用边界和用户价值。

## 为什么先 Spike

- Web 和小程序还处在验证阶段，立即引入 App 会增加发布、签名、权限、商店审核和真机调试成本。
- 如果 App 只是套壳 Web，价值不够明显。
- Tauri 更适合验证桌面常驻、离线缓存、本地提醒、系统通知、文件能力等增量能力。

## Spike 目标

- 验证是否能复用 `apps/web` 的 UI。
- 验证 `crates/recommend` 是否能继续作为共享业务内核。
- 验证 Tauri Rust command 和现有 Rust WASM 的边界。
- 验证 IndexedDB / 本地文件 / SQLite 等离线持久化路线。
- 验证桌面端是否比小程序更适合“常驻花圃”和“情绪示波器”。

## 非目标

- 不做 App Store / 应用市场发布。
- 不新增独立业务逻辑。
- 不把 Axum 后端直接塞进 Tauri，除非明确要做本地离线服务。
- 不让 Tauri 端和 Web / 小程序分叉业务规则。

## 架构原则

- 业务逻辑仍然优先 Rust / Rust WASM。
- Tauri 只负责桌面壳、本机能力、系统集成和本地持久化。
- Web / 小程序 / Tauri 共享同一套 Rust 业务内核。

## Spike 验收标准

- 能启动最小 Tauri 壳并加载 Roselet Web UI。
- 能调用一个 Rust command。
- 能复用 `crates/recommend` 的至少一个纯 Rust 函数。
- 能跑通本地持久化 PoC。
- 文档记录：收益、成本、风险、是否进入产品化。

