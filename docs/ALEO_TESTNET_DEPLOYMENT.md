# Aleo Testnet 部署手册 — roselet_private_vault.aleo

> 目标：在 8.14 Hackathon 提交截止前完成真实 Testnet 部署与端到端交易，把证据补进 `docs/HACKATHON_ALEO_SUBMISSION.md`。
> 名称可用性已确认：2026-07-30 查询 `https://api.explorer.provable.com/v1/testnet/program/roselet_private_vault.aleo` 返回 404，程序名未被占用。

## 前置条件

- Leo CLI 4.0.2（本机已安装：`/Users/qiaopengjun/.cargo/bin/leo`）
- 一个 Aleo Testnet 账户（私钥 `APrivateKey1zkp...`），账户内有足够 Testnet credits 支付部署费与执行费
- Testnet credits 获取：Aleo 官方 faucet（https://faucet.aleo.org ）或 Leo Wallet 内 Testnet faucet
- **私钥不写入 Git、不写入文档**，只通过环境变量传入

## 1. 本地最终确认

```bash
cd contracts/aleo-private-vault
leo test --offline
leo build --offline
```

## 2. 部署

```bash
cd contracts/aleo-private-vault
export PRIVATE_KEY="APrivateKey1zkp..."   # 仅当前 shell，勿落盘
leo deploy \
  --network testnet \
  --endpoint https://api.explorer.provable.com/v1 \
  --broadcast
```

- 部署费从账户公开余额扣除；如交易 pending，等待确认后重试查询。
- 成功后记录 **deployment transaction ID**。

## 3. 验证部署

```bash
curl -sS "https://api.explorer.provable.com/v1/testnet/program/roselet_private_vault.aleo" | head -c 400
```

返回 program 源码即部署成功（部署前该接口返回 404）。

## 4. 端到端执行（命令行冒烟）

用四个测试 field 值执行 `plant_private_rose`（浏览器流程会由 WASM 生成真实承诺）：

```bash
leo execute plant_private_rose 1field 2field 3field 4field \
  --network testnet \
  --endpoint https://api.explorer.provable.com/v1 \
  --broadcast
```

记录 **execution transaction ID** 和输出的 `PrivateRose` record（owner 应为 `self.signer` 即部署账户）。

## 5. 浏览器钱包链路

```bash
NEXT_PUBLIC_ALEO_VAULT_PROGRAM_ID=roselet_private_vault.aleo
NEXT_PUBLIC_ALEO_EXECUTION_FEE_MICROCREDITS=100000
```

配置到 Web 环境后，在 `/private-vault` 页面用 Leo Wallet（Testnet）完成一次真实种植，确认钱包弹窗中只出现四个 `field` input。

## 6. 提交证据清单（补进 HACKATHON_ALEO_SUBMISSION.md）

1. Deployment transaction ID + explorer 链接
2. `plant_private_rose` execution transaction ID + explorer 链接
3. 钱包弹窗截图（可见仅四个 field input）
4. （可选）`rotate_share_key` / `share_private_rose` 交易 ID

## 排障

- `Program not found`：部署交易未确认，等 1-2 个区块后重查。
- 余额不足：部署费较高（按 program 大小计费），先小额执行一次 `credits.aleo/transfer_public` 确认账户可用。
- 名称被抢注：改 `program.json` 与 `main.leo` 中的程序名（如加后缀），并同步 `NEXT_PUBLIC_ALEO_VAULT_PROGRAM_ID` 与 `apps/web` 中的默认程序 id。
