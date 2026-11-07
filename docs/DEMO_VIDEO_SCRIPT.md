# 演示视频脚本 — Roselet（Aleo Hackathon / GOAT Grant 通用）

> 目标时长 3-4 分钟。主线讲 Aleo Private Vault（AI × Privacy），副线带 Agent 支付。
> 录屏工具任意；先录 Testnet 部署后的真实链路，未部署前可先录本地版并在视频说明中标注。

## 镜头 1：问题（20 秒）

- 画面：Roselet 首页 / 花圃页
- 旁白：情绪记录是最私密的数据之一。今天的 AI 产品要么把原文发给服务器，要么把内容公开上链。Roselet 想证明第三条路：AI 可以有用，同时内容默认私有。

## 镜头 2：产品本体（30 秒）

- 画面：Web 端种一朵公开玫瑰，展示花语/主题/颜色推荐
- 旁白：Roselet 是一个种玫瑰的情绪记录产品，推荐引擎是 Rust 编译的 WASM，同一套核心跑在 Web、小程序、HTTP API 和 MCP Tool 上。已有生产用户。

## 镜头 3：Private Vault 核心演示（90 秒，重点）

- 画面：`/private-vault` 页面，连接 Leo Wallet（Testnet）
- 操作：输入一段私密文字 → 本地生成 AI 回应 → 点击种下
- 关键镜头：**钱包弹窗特写**，逐行指出交易 input 只有四个 `field`，没有原文
- 旁白：原文和 AI 回应永远不离开浏览器。WASM 在本地生成域分隔的 SHA-256 承诺，链上只有承诺和所有权。这是 `PrivateRose` record。
- 画面：展示 explorer 上的交易（部署后补录）

## 镜头 4：分享与撤销（40 秒）

- 操作：`share_private_rose` 生成 `RoseShare` → `rotate_share_key` 使旧 nonce 失效
- 旁白：分享是显式授权，生成一个接收方拥有的 RoseShare record；撤销就是旋转密钥，旧分享立即失效。链上全程无原文。

## 镜头 5：Agent 支付（40 秒）

- 画面：终端 curl `POST /v1/goat/reflection/orders` 返回 402 + PAYMENT-REQUIRED；展示 `complete` 在 INVOICED 后返回推荐
- 旁白：同一个推荐引擎也通过 x402 向 AI Agent 出售。Solana 路径走标准 x402 SVM，GOAT 路径走官方商户订单，只有链上确认 INVOICED 且 proof 匹配后才交付内容。

## 镜头 6：工程证据与收尾（20 秒）

- 画面：GitHub 仓库测试列表 / CI 绿灯 / DEVLOG
- 旁白：611 个自动化测试，三条链三种真实需求：Base 公开纪念、Aleo 私密 vault、x402 Agent 支付。代码全部开源。

## 录制前检查清单

1. `leo deploy` 完成且 explorer 可查（见 `docs/ALEO_TESTNET_DEPLOYMENT.md`）
2. Web 环境已配置 `NEXT_PUBLIC_ALEO_VAULT_PROGRAM_ID`
3. Leo Wallet 切换到 Testnet 且有余额
4. Agent API 本地启动（GOAT 冒烟需 `GOATX402_*` 凭据；无凭据时演示 503 设计也可以，但优先录真实链路）
5. 提前准备一段不敏感的演示用私密文字
