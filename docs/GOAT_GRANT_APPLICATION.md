# GOAT AI Builder Grants 申请表草稿

> 申请入口：https://tally.so/r/EkJo42 （共 10 页，长期开放）
> 本文档按表单字段逐题准备答案，拿到 GOAT 商户 API key/secret 并完成一笔 Testnet3 真实订单后即可提交。

## 基本信息

- 姓名/昵称：Qiao Pengjun（按实际填写）
- Telegram：（按实际填写）
- GitHub：https://github.com/qiaopengjun5162
- 所在地：中国
- 来源：（按实际填写，如 Twitter / 社区 / 朋友推荐）

## 团队

- Solo builder。项目为开源个人项目，代码、合约、文档全部公开在 GitHub。

## 过往项目与链接

- Roselet（本项目）：https://github.com/qiaopengjun5162/roselet
  - 生产环境：https://roselet.paxonqiao.com/ （Web + 微信小程序双端，Rust Axum 后端，AWS Lightsail 部署）
  - 已有 Base Sepolia ERC-721 合约 + Foundry 测试、Aleo Leo program + 钱包流程、Solana x402 支付 API

## 产品是什么

Roselet 是一个 AI 情绪记录产品：用户写下感恩、焦虑或期待，Rust WASM 推荐引擎生成花语、主题和颜色建议，形成一朵「玫瑰」。Agent API 把这个推荐能力包装成按次付费的 HTTP API 和 MCP Tool，让 AI Agent 可以为每次情绪分析调用付费。

## 目标用户

- AI Agent 开发者：需要为 Agent 的情绪/心理类能力找到可计价、可结算的 API
- MCP 生态用户：通过 `roselet_reflection` MCP Tool 直接在 Claude 等客户端中调用
- 终端用户：Web 与小程序已有真实用户基础的情绪记录产品

## 解决什么问题

Agent 调用优质垂直 API 时缺少原生的按次支付能力：传统 API key 订阅模式不适合 Agent 自主决策的调用模式。x402 让 Agent 在收到 HTTP 402 后自主完成支付并重试，Roselet 把这套流程落到真实业务（情绪分析推荐）上。

## 用户为什么付费

- 推荐引擎是跨端共享的 Rust WASM 核心，已服务 Web/小程序真实用户，不是为 Grant 临时拼凑的 demo
- 每次调用价格极低（$0.001 级别），适合 Agent 高频小额调用
- 隐私路线（Aleo）保证敏感情绪内容可以以 commitment 形式上链，适合心理/情绪这类敏感场景

## 用户流程

1. Agent 调用 `POST /v1/reflection`（Solana x402）或 `POST /v1/goat/reflection/orders`（GOAT）
2. 收到 HTTP 402 + `PAYMENT-REQUIRED`，x402 客户端签名支付
3. Solana 路径：facilitator 结算后立即返回推荐；GOAT 路径：链上确认后调用 `/v1/goat/reflection/complete`，服务端校验订单 `INVOICED` + proof 匹配后交付推荐

## 交易频率预期

按次付费，单笔 $0.001 级别；Agent 场景预期高频小额。MCP Tool 每次调用都是一笔独立 x402 支付。

## AI 在产品中的作用

推荐引擎是产品的核心价值：解析情绪文本（感恩/焦虑/期待），输出花语、主题、颜色建议。引擎编译为 Rust WASM，同一套逻辑服务 Web、小程序、HTTP API 和 MCP Tool。

## 移除 AI 后会破坏什么

移除推荐引擎后，API 将没有任何可交付内容——x402 支付保护的就是 AI 生成的推荐结果本身。支付是外壳，AI 推荐是商品。

## 是否接入 GOAT

- 选择：**x402 payments**
- 实现：官方 `goatflow-sdk-server@0.3.0`，DIRECT 商户模式
  - `GET /v1/goat/merchant`：商户公开配置发现
  - `POST /v1/goat/reflection/orders`：Rust WASM domain-separated `dapp_order_id` 绑定订单与内容，返回 HTTP 402 + PAYMENT-REQUIRED
  - `POST /v1/goat/reflection/complete`：仅 `INVOICED` + 订单字段匹配 + proof 校验后交付
- 代码：https://github.com/qiaopengjun5162/roselet （`apps/agent-api/src/goat-*.ts`，PR #6）

## 是否申请 GOAT x402 Integration Faucet

是。需要 Testnet3 测试代币完成真实订单链路验证与演示视频录制。

## 是否使用 ClawUp

（按实际情况填写；当前未使用）

## 项目状态

- Solana x402 路径：端到端已验证到 facilitator simulation，待 Devnet USDC 结算
- GOAT 路径：商户订单/状态/proof 门控逻辑完成，35 个自动化测试通过（fake client），待商户凭据 + faucet 后跑真实 Testnet3 订单
- 主产品（Web/小程序/后端）：生产环境运行中

## Traction

- 生产环境真实用户（Web + 微信小程序）
- 611 个自动化测试（Rust 后端 149 / Rust WASM 153 / Web 208 / 小程序 66 / Agent API 35）
- 三条链的真实工程：Base Sepolia 合约 + Foundry 测试、Aleo Leo program、Solana x402 facilitator simulation

## 官网

https://roselet.paxonqiao.com/

## 补充说明

Roselet 的差异点是「一套 Rust WASM 核心，三链三种真实需求」：Base 做公开纪念（永久性），Aleo 做私密 vault（隐私），Solana/GOAT x402 做 Agent 支付（可计价）。GOAT 路径的设计刻意严格：只有权威订单状态 `INVOICED` 且结算 proof 字段匹配才交付内容，`PAYMENT_CONFIRMED` 不被当作最终交付凭据。
