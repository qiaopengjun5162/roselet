# 小程序云测验收流程

> 快速开始：https://developers.weixin.qq.com/miniprogram/dev/devtools/minitest/fast_start.html
> AIMonkey：https://developers.weixin.qq.com/miniprogram/dev/devtools/minitest/ai_monkey.html

## 适用范围

微信官方云测在使用前需要满足：

- 必须有体验版或线上版小程序，不支持测试普通开发版。
- 当前用户需要是该小程序的开发者或管理员。
- 只支持小程序，不支持小游戏。

## 打开方式

- 推荐方式：在微信开发者工具中安装“云测”插件。这样可以同步开发者工具里的小程序和用户信息。
- 备用方式：直接打开云测 Web 地址并微信扫码登录。

## 提测前 Roselet 检查清单

1. 执行 `just wasm-mini`，确保小程序 WASM 构建和 WXWebAssembly patch 完成。
2. 执行 `cd apps/miniprogram && pnpm typecheck`。
3. 执行 `cd apps/miniprogram && pnpm test:coverage`。
4. 执行 `just miniprogram-build`。
5. 在微信开发者工具导入 `apps/miniprogram/dist/weapp`。
6. 确认后端已启动：`cargo run -p roselet-backend`。
7. 上传体验版后再进入云测。

## 云测重点关注

- 登录 / 双令牌刷新是否正常。
- 种花流程是否能提交。
- 私密模式开关和锁标识是否正常。
- 公共花圃不展示私密玫瑰。
- 我的花圃能展示自己的私密玫瑰。
- WASM 花瓣、颜色、表单校验是否正常。
- 报告中的 JsError、黑白屏、截图和性能达标率。

## AIMonkey

AIMonkey 是微信云测里的 AI 自动化测试模式，适合作为 Roselet 小程序的探索式回归测试。

### 官方要点

- AIMonkey 依托大模型能力驱动测试，比传统智能化 Monkey 更接近人类感知。
- AIMonkey 执行完成后会自动生成本次操作的 Minium 代码。
- 生成的 Minium 代码可以下载，再上传为 Minium 用例，用于回放本次 Monkey 过程。
- 鸿蒙操作系统只支持 AIMonkey 模式；即使页面选择智能化 Monkey，云测也会自动切到 AIMonkey。
- AIMonkey 不支持原智能化 Monkey 的拓展能力，例如不支持配置前置步骤。

### Roselet 使用建议

1. 提交云测任务时，在 Monkey 测试类型的测试计划中选择 `AIMonkey`。
2. 优先覆盖不需要复杂前置状态的路径：
   - 首屏 / 导航栏
   - 花圃浏览
   - 颜色筛选
   - 关于页 / 反馈页
   - 登录入口和错误态
3. 对需要固定账号状态的路径，优先用“测试账号”方案或 Minium 自定义用例，不依赖 AIMonkey 前置步骤。
4. AIMonkey 跑完后检查“自动生成用例”Tab；如果发现高价值路径，把生成的 Minium 代码沉淀为可回放用例。
5. 如果报告发现黑白屏、JsError、WASM 加载失败、页面卡死，先在本地微信开发者工具复现，再补 Jest / Minium 回归测试。

### Roselet 重点风险

- WASM 初始化失败后是否有可见错误或降级。
- 登录态过期后是否能静默刷新，刷新失败是否回登录页。
- 私密模式是否会被 AIMonkey 随机操作误提交。
- 花圃 WebSocket / 本地缓存恢复是否导致重复玫瑰或过期 UI。
- 表单输入为空、超长、切换颜色、多次点击提交时是否稳定。

## 经验规则

云测不是本地 Jest 的替代品。它用于覆盖真机环境、兼容性、黑白屏、性能和弱网络等问题；本地单元测试仍然是提交前门禁。

AIMonkey 适合发现未知路径问题，但不能替代确定性回归测试。发现稳定复现的问题后，要沉淀成 Rust 单元测试、Jest 测试或 Minium 用例。
