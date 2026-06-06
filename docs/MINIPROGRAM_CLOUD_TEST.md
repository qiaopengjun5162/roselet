# 小程序云测验收流程

> 官方入口：https://developers.weixin.qq.com/miniprogram/dev/devtools/minitest/fast_start.html

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

## 经验规则

云测不是本地 Jest 的替代品。它用于覆盖真机环境、兼容性、黑白屏、性能和弱网络等问题；本地单元测试仍然是提交前门禁。

