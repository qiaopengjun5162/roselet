# Roselet 多语言策略

## 当前决策

Roselet 暂不立即产品化完整中英文切换，默认产品语言仍为中文。

原因不是技术上不能做，而是当前产品语义和中文社区表达绑定较深：玫瑰、花苞、尖刺的情绪语义，花语推荐，中文关键词，日期显示，AI 回复 prompt，以及 Web / 小程序的界面文案都需要一起本地化。只在前端加一套 `en.json` 会造成 Web、小程序和 Rust WASM 逻辑分叉。

## 什么时候启动完整双语

满足任一条件时，再把双语列为产品功能：

- 明确要面向英文用户测试或发布。
- 5 人试用里出现英文使用需求，且不是个别临时反馈。
- AI 回复需要稳定支持英文输入和英文输出。
- App / Tauri Spike 进入产品化，目标用户不只中文环境。

## 分层原则

多语言也遵守 90/10 Rust-TS 架构。

- Rust WASM 拥有：可测试的本地化业务文案、枚举 label、日期格式、颜色名称、情绪标签、花语、主题推荐、AI prompt 模板选择、关键词词典。
- TS 拥有：读取用户 locale、调用 WASM、渲染文案、平台存储、网络请求、样式和组件排版。
- 后端拥有：API 字段保持稳定，必要时接收 `locale` 参数并传给 AI prompt 或返回本地化错误信息。

判断标准：凡是 Web 和小程序都要一致、且可以写 Rust 单元测试的文案映射，都不应分别写在两个 TS 端。

## 推荐模型

Locale 先收敛成两个明确值：

```rust
pub enum Locale {
    ZhCn,
    EnUs,
}
```

WASM 边界使用字符串参数，例如 `"zh-CN"` / `"en-US"`；未知值降级为 `"zh-CN"`。

优先做类型化导出，而不是自由字符串翻译函数：

- `color_label(color, locale)`
- `format_date_wasm(timestamp, locale)`
- `emotion_label(kind, locale)`
- `flower_language(category, locale)`
- `build_ai_prompt(input, locale)`

自由的 `t(key)` 可以用于纯 UI 文案，但不应承载业务规则。

## 迁移顺序

1. **梳理文案来源**：列出 Web、小程序、Rust WASM、后端 AI prompt 中所有用户可见文本。
2. **先迁移跨端业务文案**：颜色 label、情绪 label、日期、花语、主题推荐。
3. **再接 UI locale source**：Web 用浏览器/用户设置，小程序用系统语言或用户设置。
4. **最后处理 AI**：prompt 按 locale 分开，并补中英文输出测试。
5. **避免一次性大改**：每次迁移一个模块，保持 Web、小程序和 Rust 测试都可通过。

## 测试策略

- Rust WASM：每个本地化模块都要覆盖 `zh-CN`、`en-US`、未知 locale 降级。
- Web：只测 locale 选择、WASM 调用和关键页面渲染，不重复测试业务映射。
- 小程序：同 Web，重点测系统语言读取和 fallback。
- AI：中文 prompt / 英文 prompt 分开快照或规则断言，避免混用。
- 覆盖率门禁仍按现有 `just coverage` 和 Rust coverage 目标执行。

## 非目标

- 当前不做全量 UI 文案翻译。
- 当前不做用户语言设置页面。
- 当前不改数据库 schema 存多语言内容。
- 当前不把 Web 和小程序各自维护成独立 i18n 字典。

## 更新规则

后续如果新增用户可见文案，按下面顺序判断：

1. 是否跨 Web / 小程序共用？
2. 是否和业务语义、枚举、算法、AI prompt 或可测试规则有关？
3. 如果是，优先放进 `crates/recommend/src/` 的 locale-aware Rust 逻辑。
4. 如果只是单端布局提示或按钮文案，可留在对应 TS 组件，但要避免同一句话在两端重复维护。
5. 一旦新增或修改多语言规则，同步更新本文件、`DEVLOG.md`，必要时更新 `CLAUDE.md` / `AGENTS.md`。
