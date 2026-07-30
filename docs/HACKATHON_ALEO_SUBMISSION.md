# Aleo Hackathon 提交材料 — Roselet Private Vault

> 赛道：AI × Privacy。报名截止 2026-08-01 23:59，提交截止 2026-08-14 23:59。
> 报名入口：https://hackathon.xyz/events/public/e7ad6199-0078-42ee-9846-b82c385e4c0e
> 仓库：https://github.com/qiaopengjun5162/roselet

## 项目简介（中文，可直接粘贴）

Roselet 是一个「种玫瑰」情绪记录产品：用户写下感恩、焦虑或期待，Rust WASM 推荐引擎生成花语、主题和颜色建议，形成一朵可保存、可分享的玫瑰。

本次参赛新增 **Private Vault**：把最私密的 reflection 内容变成 Aleo 链上的私有记录。原文和本地 AI 回应只在浏览器内由 Rust WASM 做 domain-separated commitment，钱包交易只接收四个 `field` 承诺值；原文永远不离开浏览器，不发给 Roselet 后端，也不进入链上公开 mapping。用户可以种下私有玫瑰（`PrivateRose` record）、旋转分享密钥（`rotate_share_key`）、把阅读权分享给指定地址（`RoseShare` record），实现「内容默认私有、分享显式授权、授权可轮换失效」。

AI 在这里的角色是隐私计算的一部分而不是数据收集方：推荐引擎编译成 WASM 在本地运行，连 AI 回应本身也只以 commitment 形式上链。

## Project summary (English)

Roselet is an emotional journaling product where users plant "roses" from gratitude, anxiety, and hope notes. A Rust-to-WASM recommendation engine generates flower language, themes, and color suggestions.

For this hackathon we built **Private Vault**: private reflections become Aleo records. The plaintext and the local AI reply never leave the browser — a Rust WASM module produces domain-separated SHA-256 commitments, and the wallet transaction only carries four `field` values. Users can plant a `PrivateRose` record, rotate its share key, and issue a `RoseShare` record to a specific address: private by default, sharing is explicit, and access can be revoked by key rotation. The AI runs client-side; even its reply is only committed on-chain, never revealed.

## AI × Privacy 论证

- AI 推理在客户端完成：`crates/recommend` 编译为 WASM，推荐逻辑（情绪关键词、花语、主题、颜色）不上传任何服务器。
- 隐私边界由密码学承诺保证：`build_aleo_vault_inputs` 用 `roselet-aleo-v1` 域分隔 SHA-256，把 rose_id / 原文 / AI 回应 / 分享 nonce 映射为四个 `field`。
- 链上只存承诺与所有权：Leo program `roselet_private_vault.aleo` 的 `PrivateRose` / `RoseShare` record owner 固定为 `self.signer`，不存在公开 mapping 泄露内容。
- 选择性披露：分享 = 生成 `RoseShare` record + 链下传递 nonce；撤销 = `rotate_share_key` 使旧 nonce 失效。

## Aleo 使用方式（技术说明）

- Leo program：`contracts/aleo-private-vault/src/main.leo`
  - `plant_private_rose(rose_id, content_commitment, ai_reply_commitment, share_key) -> PrivateRose`
  - `rotate_share_key(PrivateRose, new_share_key) -> PrivateRose`
  - `share_private_rose(PrivateRose, recipient) -> (PrivateRose, RoseShare)`
- 前端：`/private-vault` 页面接入 Leo Wallet（Testnet），交易 input 仅四个 `field`，由浏览器内 Rust WASM 生成。
- 测试：Leo build/test 通过；Rust commitment 层有确定性与边界单元测试。

## 活动期间新增内容（7.1 - 8.14 窗口内）

- 全新 `roselet_private_vault.aleo` Leo program（records + 三个 transition）
- 浏览器端 Rust WASM commitment 层（`crates/recommend/src/aleo.rs`）
- `/private-vault` Leo Wallet Testnet 页面
- 同期构建的 Agent 支付能力（Solana x402 + GOAT x402 商户订单）作为生态延展，不计入 Aleo 赛道核心交付

## Demo 流程（评委复现路径）

1. 打开 `/private-vault`，连接 Leo Wallet（Testnet）。
2. 输入一段私密 reflection，页面本地生成 AI 回应。
3. 点击「种下私密玫瑰」：WASM 生成四个 field 承诺，钱包签名 `plant_private_rose`。
4. 在钱包/浏览器中确认交易只包含 field 值，不包含原文。
5. 演示 `share_private_rose` 分享与 `rotate_share_key` 撤销。

## 诚实边界

- Leo build/test 与钱包请求流程已验证；**Aleo Testnet program 尚未部署**，真实链上交易待部署后补录。
- AI 推荐为本地规则引擎（Rust WASM），未接入外部大模型；这恰恰强化了隐私叙事。

## 未来规划

1. 部署 `roselet_private_vault.aleo` 到 Aleo Testnet 并完成端到端交易（提交前完成）。
2. 分享 nonce 的链下安全传递（端到端加密链接）。
3. 私密玫瑰与公开纪念版（Base ERC-721）的双层架构：默认私有，用户可主动选择公开。
4. Agent 支付（x402）接入私密 API：付费但不泄露内容的 Agent 情绪分析服务。
