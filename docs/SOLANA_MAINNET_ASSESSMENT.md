# Solana 主网化评估（仅方案）

> 范围说明：本文只做评估与落地清单，**不改动任何业务代码**。基于 `main`（`7b53fb9`）当前 Solana 会员上链 + IPFS 闭环节点的代码事实核查。
> 目标：帮你在「上主网」前看清成本、风险与不可逆点，做出是否上、怎么上的决策。

---

## 1. 当前 Devnet 方案事实核查

先讲清现在「上链」到底做了什么，避免评估时夸大或漏看风险。

| 项 | 现状（已查代码） |
|---|---|
| 链上动作 | 写一条 **SPL Memo 交易**（官方程序 `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`），Memo 文本含 rose id 等声明信息。**没有自定义合约 / Anchor / Metaplex。** |
| 数据存储 | 玫瑰本体仍在 Roselet 自己的 Postgres；Solana 只存「钱包 X 在时刻 T 把 rose Y 声明上链」的存证引用（`solana_mints` 表）。 |
| 后端核验 | `SOLANA_RPC_URL` + `getTransaction`：交易存在 / `meta.err` 为 null / 首签名匹配 / fee payer 匹配 / 确实调用 Memo 程序 / Memo 含 rose id（防重放）。 |
| 钱包与私钥 | 用户用 Phantom **自签**，后端不接触任何用户私钥（符合 AGENTS.md 红线）。 |
| 图片存储 | Pinata **中心化 pinning**，JWT 仅留服务端，前端只拿 CID。 |
| 集群切换 | 两个 env：`SOLANA_RPC_URL`（后端）+ `NEXT_PUBLIC_SOLANA_RPC_URL`（前端，默认 devnet）。 |
| 付费路径 | x402 Agent API 走 Devnet USDC，`X402_SVM_PAY_TO` 为公开收款地址，服务端不持付款方/商户私钥。 |

**结论**：当前是「Memo 存证」模式，不是「链上资产」模式。这是主网化路线差异最大的根源。

---

## 2. 核心决策分叉（先定这个，再谈其他）

上主网之前必须先回答一个问题：**产品要的是「存证」还是「真 NFT」？**

| 维度 | A. Memo 存证（当前形态） | B. 真 NFT / 链上资产 |
|---|---|---|
| 含义 | 链上只证明「某钱包声明过这朵玫瑰」，所有权/内容仍在 Roselet 服务器 | 玫瑰成为 Solana 上可拥有的 Token/NFT，可转移、可交易 |
| 是否需要自定义合约 | **否**（用官方 Memo 程序） | **是**（Metaplex Core / Token-2022 或自写程序） |
| 合约审计 | 不需要 | 需要（至少 1 家专业审计 + 模糊/形式化测试） |
| 主网化成本 | 极低（主要是 RPC 与运维） | 高（开发 + 审计 + 部署 + 治理） |
| 不可逆风险 | 低（交易额为零，损失仅 gas） | 高（资产逻辑 bug 直接丢钱） |
| 适合的产品定位 | 「我把这朵玫瑰上链存证 / 确权声明」 | 「玫瑰是可交易的链上收藏品」 |

> 若你的诉求是「让用户的纪念行为上链、可验证、不可篡改」，方案 A 已经够用，主网化没有技术门槛。
> 若诉求是「玫瑰本身变成可在钱包里看到的、可转移的 NFT」，才需要走方案 B 的大工程。

下文默认先评估 **方案 A 主网化**（低成本低风险），方案 B 单独列为一阶段。

---

## 3. 主网 vs Devnet 关键差异

| 差异 | Devnet | Mainnet | 应对 |
|---|---|---|---|
| 资金 | 水龙头领的玩具 SOL | 真 SOL，需真钱买入 | 用户自付 gas，或平台小额代付 |
| 不可逆 | 可随便试 | 交易无法回滚 | 上线前充分测试；UI 明确「真金白银」提示 |
| RPC | 免费公共节点可用 | 公共节点严格限流，生产不可用 | 接付费 RPC（Helius / QuickNode / Triton）或自建 |
| 历史查询 | 公共节点保留历史 | 廉价 RPC 常不保留 `getTransaction` 历史 | 选支持历史查询的 RPC；后端核验要能拿到老交易 |
| 集群切换 | devnet | mainnet | 改 `SOLANA_RPC_URL` + `NEXT_PUBLIC_SOLANA_RPC_URL` 两处 |
| 钱包网络 | Phantom 测试网 | Phantom 主网 | dApp 声明主网；前端加网络徽标与切换提示 |
| 重组（reorg） | 少见 | Solana 偶发短暂重组 | 后端核验等 `finalized` 终局性，必要时轮询重试 |

---

## 4. 各维度准备清单

### 4.1 集群与 RPC
- [ ] 后端 `SOLANA_RPC_URL` 指向主网付费 RPC（保留 Devnet 作为开关，便于回滚）。
- [ ] 前端 `NEXT_PUBLIC_SOLANA_RPC_URL` 同步切主网；构建时注入，不能硬编码 devnet。
- [ ] RPC 选择支持 `getTransaction` 历史 + `finalized` commitment 的供应商；评估月费与速率上限。
- [ ] 后端对 RPC 调用加超时、重试、熔断；RPC 挂了不能让用户上链卡死。

### 4.2 gas / 资金模型
- [ ] 默认**用户自付**（Phantom 钱包里有真 SOL 即可，Memo 交易 gas ≈ 0.000005 SOL，几乎可忽略）。
- [ ] 若要做「平台代付 / gasless」提升体验：需平台充值热钱包 + 限额 + 监控；这会引入平台资金安全风险，**建议初期不做**。
- [ ] 前端明确展示「这将消耗少量真 SOL 作为网络费」。

### 4.3 后端核验增强（主网必须）
- [ ] `getTransaction` 用 `commitment: "finalized"`，避免重组导致误存引用。
- [ ] 交易刚上链时可能暂时查不到，加短轮询/退避重试。
- [ ] RPC 返回异常（限流/历史缺失）时返回明确错误，不静默存入。
- [ ] 保留防重放（Memo 含 rose id + 钱包 + 时间窗），主网上重放攻击更有动机。

### 4.4 密钥与托管（保持现状即安全）
- [ ] **坚持用户自签、平台不碰私钥**（已是现状，主网不变）。
- [ ] Pinata JWT 继续只留服务端，绝不下发浏览器（已是现状）。
- [ ] 若未来引入平台代付钱包，必须用 KMS / 多签 + timelock，禁止明文私钥进 Git（AGENTS.md 红线）。

### 4.5 存储去中心化（独立议题，可后做）
- [ ] 现状 Pinata 中心化 pinning：Pinata 停服/删数据 = 图片丢失，但 CID 仍在链上（无人 pin 就取不到）。
- [ ] 主网用户对「永久可访问」预期更高，建议：多 pin 服务冗余（Pinata + 第二家 + 公共 IPFS）、或 Arweave（一次付费永久）、或 Filecoin。
- [ ] 此项不阻塞主网化，可列为后续阶段。

### 4.6 合规（仅当引入真钱付费时才触发）
- [ ] 当前 x402 走 Devnet 玩具 USDC，**无合规负担**。
- [ ] 若主网用真 USDC 收款（付费会员），需评估：经营性质、KYC、税务、支付牌照（视司法辖区）。
- [ ] 建议：先用免费 Memo 存证跑通产品，付费 USDC 单独立项评估合规。

### 4.7 内容与法律
- [ ] 上链内容不可删（玫瑰正文本就不可改，契合）。
- [ ] UGC（图片/留言）上链前需内容审核机制，避免不可撤销的违规内容。

---

## 5. 分阶段落地路线

> 每阶段标注：是否动代码 / 是否花钱 / 风险等级。

- **阶段 0 · 决策**（不动代码，不花钱）
  - 定 A（存证）还是 B（真 NFT）；定免费还是付费。
  - 产出：本文 + 你的拍板。

- **阶段 1 · Memo-only 主网化**（方案 A，低风险）
  - 动代码：仅配置 + 后端核验增强（finality / 重试 / 错误透出）+ 前端网络提示。
  - 花钱：付费主网 RPC（约 $0–50/月量级，需实测）。
  - 风险：低。无需合约审计。

- **阶段 2 · 真 NFT（仅当选 B）**（高风险）
  - 动代码：选标准（Metaplex Core / Token-2022）、部署程序、写铸造/转移逻辑。
  - 花钱：开发 + 安全审计（专业审计通常 $10k–$100k+ 量级）+ 部署。
  - 风险：高。需升级权限治理（多签 + timelock），防私钥单点。

- **阶段 3 · 存储去中心化**（中风险，独立）
  - 多 pin / Arweave / Filecoin，降低图片单点失效。

- **阶段 4 · 付费合规（仅当选付费）**（中高风险）
  - 法律评估、收款地址、税务；与阶段 2 可并行规划。

---

## 6. 风险矩阵

| 风险 | 触发条件 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| 主网 gas 成本 | 用户钱包无 SOL | 中 | 低（体验问题） | 清晰提示；可选平台小额代付（谨慎） |
| RPC 不稳/限流 | 用错/廉价 RPC | 中 | 中（上链卡死） | 付费 RPC + 超时重试熔断 |
| 重组误存 | 用 `confirmed` 而非 `finalized` | 低 | 中 | 等终局性 + 重试 |
| 私钥泄露 | 平台代付钱包管理不当 | 低 | 高 | 坚持用户自签；代付用 KMS/多签 |
| 合约 bug（仅 B） | 自写程序逻辑错误 | 中 | 高 | 专业审计 + 多签 timelock |
| 合规（仅付费） | 主网真 USDC 收款 | 视辖区 | 高 | 先免费跑通，付费单独立项 |
| 存储单点 | 仅 Pinata | 中 | 中 | 多 pin / Arweave（阶段 3） |
| UGC 违规上链 | 无审核直接上链 | 中 | 中 | 上链前内容审核 |

---

## 7. 决策建议（结论优先）

1. **若产品定位是「上链存证 / 确权声明」**：当前 Memo-only 方案主网化**成本极低、风险可控**，主要是 RPC 与运维，不需要合约审计。建议先在 Devnet 验证产品市场契合（PMF），再走阶段 1 上主网。
2. **若产品定位是「真 NFT + 付费」**：这是大工程（开发 + 审计 + 合规），**不要急着上主网**。先在 Devnet 把产品跑顺、验证有人愿意用，再立项阶段 2/4。
3. **密钥与存储策略维持现状即安全**：用户自签 + Pinata JWT 服务端留存，已符合安全红线；存储去中心化可列为后续增强，不阻塞主网。
4. **回滚很便宜**：集群靠 env 两处切换，主网若出问题可即时切回 Devnet 观察，无需改代码重新发布。

---

## 8. 验证与回滚

- **验证主网就绪**：在隔离测试环境把两处 env 切到主网付费 RPC，用少量真 SOL 跑一遍「连钱包 → 上链 → 后端核验 → 存引用」全链路；确认 `getTransaction` 终局性核验稳定。
- **回滚**：改回 `SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_RPC_URL` 为 Devnet 端点并重新构建即可；代码无需回滚。
- **观察窗口**：主网切换后观察 RPC 费用、上链成功率、核验失败率至少 1–2 周。

---

## 9. 本地先例（prior art）与成本修正

盘点 `~/Code/Solana` 下 26 个项目后，与 roselet 直接相关的是下面这些（均为可直接读的本地代码，非外部参考）：

| 项目 | 提供的能力 | 对 roselet 的用处 |
|---|---|---|
| `shenqi-box/programs/token_2022_nft` | Token-2022 NFT：`MetadataPointer` 指向 mint 自身、PDA 授权、mint 1 枚后撤销 mint 权限、`NftMinted` 事件、按 `tlv_size_of` 动态算空间 | **若走 B 路线，首选这套**：无 Metaplex 依赖、账号更少、租金更低；配套 `tests/token_2022_nft.ts` |
| `shenqi-box/programs/metaplex_nft` | Metaplex：`mint_to` + ATA + `create_metadata_accounts_v3` + `create_master_edition_v3` | 生态兼容性最好（钱包/二级市场直接识别），但账号最多、租金最高 |
| `solana-event-indexer` | Rust + `RpcClient` 按 slot 扫块 → `parser.rs` 解析 → sqlx/Postgres 落库，事件里含 `priority_fee_lamports` | 若数据要上链，用「程序发事件 + 索引器入库」替代逐笔 `getTransaction` 核验，检索能力更强 |
| `secure_transfer_gate` | 用 instruction sysvar 反查调用链（防 CPI 冒充）+ `paused` 开关 + 事件 | 会员/付费程序的调用链校验范式 |
| `solana_forge` | 同一件事的 web3.js / `@solana/kit` / gill 三套写法 | 前端 SDK 选型参考；现用 `@solana/web3.js` 已够，无需迁移 |
| `pinocchio_*` / `blueshift_*` | 原生零拷贝程序、vault / escrow / AMM 模板 | 后续做高性价比链上程序时的模板与测试范式 |
| `solana-storage` | 原生 on-chain storage 程序 | 「信息上链」的另一种形态，但成本远高于 Memo |

### 9.1 三条上链路线的真实成本（Devnet 实测）

**先纠正一个流传很广的旧参数**：网上教材（含 Solana 官方培训 Module 1）写的是 `3480 × (128 + len) × 2`。实测读取 Devnet **与主网**的 `SysvarRent` 账户：

```
lamports_per_byte_year = 5080     exemption_threshold = 1.0
⇒ 租金 = (128 + data_len) × 5080 lamports
```

即租金单价已从 6960 降到 **5080 lamports/字节**，比旧教材低约 27%。下表据此重算，Token-2022 一行是**实跑结果**（见 9.3）。

| 路线 | 链上账号（实测长度） | 租金押金 | 手续费 | 合计现金流 |
|---|---|---|---|---|
| **A. Memo 存证**（现状） | 无（不创建账号） | **0** | 5,000 lamports | **0.000005 SOL** |
| **B1. Token-2022 NFT** | mint 352 B（含 MetadataPointer + 内联元数据）+ ATA 170 B | **0.00395724** | 5 × 5,000 | **0.00398224 SOL/朵**（实测） |
| **B2. Metaplex NFT** | mint 82 + ATA 165 + MetadataV3 679 + MasterEdition 282 | 0.0087376 | ≈ 5 × 5,000 | **≈ 0.00876 SOL/朵**（公式估算） |
| B3. 压缩 NFT（cNFT） | 无独立账号，挂在 Merkle tree 上 | 极低 | 极低 | ≈ 0.00001 SOL/朵（**本地无先例**，需 tree + DAS 索引器） |

即：Memo 比 Token-2022 便宜约 **800 倍**，比 Metaplex 便宜约 **1750 倍**。若玫瑰元数据更长（`uri` 用真实 IPFS CID + 一个 `roseId` 字段），Token-2022 约涨到 **0.0045 SOL/朵**。
两个 NFT 方案的具体 lamports 也会由程序自己 `msg!("... lamports required")` 打日志（`shenqi-box/programs/token_2022_nft/src/lib.rs:72-77`）。

### 9.2 由此调整的建议

1. **只为「确权 / 存证」**：继续 Memo，不要为省钱而迁就 NFT；两者解决的不是同一个问题。
2. **若确实要让玫瑰成为可转让资产**：选 **B1 Token-2022**，直接复用 `shenqi-box` 的程序结构与测试，只需把 `name/symbol/uri` 换成本朵玫瑰的元数据（`uri` 用已上传的 IPFS CID）。
3. **除非要上 Magic Eden 等二级市场**，否则不要选 B2 Metaplex——多付一倍租金，换来的是生态兼容性。
4. **前端不需要迁移 SDK**：`solana_forge` 已证明 web3.js 能覆盖当前需求；`@solana/kit` 只在需要更强类型/可组合性时再考虑。
5. **数据要可查询时再引入索引器**：`solana-event-indexer` 的「扫块 + 解析 + Postgres」结构与本项目后端同栈（Rust + sqlx），可低成本移植。

---

## 10. Devnet 实测记录（2026-11-07）

用一次性探针钱包（不污染主账户）按 `token_2022_nft` 的同款布局实跑一遍，全部数据来自链上，不是估算。

### 10.1 环境事实
| 项 | 结果 |
|---|---|
| 本地主账户 | `6MZDRo5v8K2NfdohdD76QNpSgk3GH3Aup53BeMaRAEpd`，Devnet 余额 ≈ 896.8 SOL |
| `shenqi-box` 两个 NFT 程序 | 均已部署在 **Devnet**，升级权限 = 本地主账户 |
| RPC 可达性 | **本机直连 `api.devnet.solana.com` 失败**，必须走本机代理 `http://127.0.0.1:7890`。这条同样适用于后端 `SOLANA_RPC_URL` 与前端 `NEXT_PUBLIC_SOLANA_RPC_URL` |
| CLI | `solana-cli 3.1.14` / `spl-token-cli 5.5.0` |

### 10.2 Token-2022 NFT 逐步成本（mint 布局与 `token_2022_nft` 一致）

| 步骤 | 结果 | 增量成本（lamports） |
|---|---|---|
| `create-token --program-2022 --enable-metadata` | mint 账户 234 B | 租金 1,838,960 + fee 5,000 |
| `initialize-metadata "Rose #1" "ROSE" "ipfs://…"` | 账户 realloc → **352 B** | 追加租金 599,440 + fee 5,000 |
| `create-account` | ATA **170 B**（Token-2022 比经典 SPL 的 165 B 多 5 B） | 租金 1,513,840 + fee 5,000 |
| `mint 1` | 供应量 1 | fee 5,000 |
| `authorize … mint --disable` | mint 权限撤销，不可再增发 | fee 5,000 |
| **合计** | | **3,982,240 lamports = 0.00398224 SOL** |

其中租金占 3,957,240（99.4%），手续费仅 25,000。

### 10.3 「rent 是押金」实证
销毁那枚 NFT 后 `close` ATA，账户租金 **1,513,840 lamports 全额退回**（余额 0.04600776 → 0.0475166 SOL），只损失 5,000 lamports 手续费。这印证了 Module 1 的说法：**租金不是花费，是押金**。

### 10.4 对当前代码的两个直接验证
| 我们代码里的假设 | 实测 | 结论 |
|---|---|---|
| Memo 交易 CU 上限设 20,000 | 实测消耗 **6,447 CU**（Memo 程序 6,297） | 20,000 有 3 倍余量，**取值合理，不必调** |
| Memo 交易手续费 = 5,000 lamports | `solana confirm -v` 显示 `Fee: ◎0.000005` | **成立**；优先费另加 |

主网拥堵时可据此定价：`优先费(lamports) = price(microLamports/CU) × 20,000 ÷ 1e6`。例如 price=50,000 → 1,000 lamports（基础费的 20%）。

### 10.5 操作教训
- 探针钱包的清理顺序必须是「**先确认余款退回成功，再删除 keypair**」。本次先删了 keypair 才核对余额，导致约 0.0475 Devnet SOL 无法找回（仅测试币，无实际损失）。
- 把余额全部转出时，**留一点零头也会失败**（`insufficient funds for rent`）：系统账户要么保持租金豁免下限，要么归零。正确做法是转出 `余额 − 5000`。

### 10.6 前端一键铸造的实测（rose 自带元数据版）
用 `apps/web/src/lib/rose-nft.ts` 的真实代码在 Devnet 铸了一枚带玫瑰寄语的 NFT：

| 项 | 实测 |
|---|---|
| mint 账户 | **525 字节** / 3,317,240 lamports（= (525+128)×5080） |
| ATA | 170 字节 / 1,513,840 lamports |
| 合计租金 | **4,831,080 lamports ≈ 0.00483 SOL** |
| 手续费 | 10,000（2 个签名 × 5000） |
| 交易大小 | 818 字节（上限 1232，余量约 33%） |

链上读回：`supply=1`、`decimals=0`、`mintAuthority=null`、`updateAuthority=<钱包>`、
`additionalMetadata=[["roseId",…],["message",…]]`。

**两个必须遵守的 Token-2022 约束（实测，不是推测）**

1. **mint 账户空间必须恰好等于「当前扩展」的大小**。`getMintLen([MetadataPointer]) = 234`；若 `createAccount` 直接给 234 + 元数据空间，`InitializeMint2` 立刻报 `InvalidAccountData`（A/B/C 三种组合实测，只有「空间 = 234」通过）。元数据初始化会自己 `realloc`，所以正确姿势是：**空间给 234，lamports 按最终大小给足**；只给 234 的租金则会在交易末尾报 `InsufficientFundsForRent`。
2. **`Transaction.sign()` 会清空已有签名**（web3.js 内部 `this.signatures = signers.map(...)`）。mint 账户的签名只能 `partialSign` 追加；钱包若丢掉它，`serialize()` 会在**广播前**抛 `Missing signature`（不花钱）。

这两点意味着「按官方示例一次性预分配 mint+metadata 空间」在当前 Token-2022 程序版本上**并不可靠**——必须实跑才能发现。

---

## 11. 前端 SDK 迁移到 `@solana/kit`（2026-11-08）

> 依据：`anza-xyz/kit` 与 `solana-foundation/solana-web3.js` 官方 README。`@solana/web3.js` v1 已进入维护模式，现行栈是 `@solana/kit` 8.x + `@solana-program/*`（Codama 生成的程序客户端）+ Wallet Standard。

### 11.1 迁移对照

| 层 | 旧（v1） | 新（kit） |
|---|---|---|
| 交易构造 | `Transaction` / `TransactionInstruction` | `createTransactionMessage` + `pipe` + `compileTransaction` |
| 指令 | `@solana/spl-token` 手写 helper | `@solana-program/{system,memo,compute-budget,token-2022}` 生成器，layout 绑定已发布 IDL |
| 钱包 | `window.solana.signTransaction`（Phantom 私有 API，只认 v1 对象） | Wallet Standard `standard:connect` / `solana:signTransaction`（签 wire bytes） |
| 签名 / 广播 | `Connection.sendRawTransaction` + 手截签名字节 | kit `getTransactionDecoder` / `getSignatureFromTransaction` / `getBase64EncodedWireTransaction` |
| 确认 | `Connection.confirmTransaction`（websocket 订阅） | `getSignatureStatuses` 轮询 `finalized`（适合代理 / 限流端点） |

### 11.2 关键判断

- **必须换钱包接口**：kit 交易是字节流，旧 API 会强迫继续保留 v1 作为桥接，等于长期背两套 SDK。Wallet Standard 的输入输出都是完整 wire 交易，且规范保留已有签名（mint 账户先签、钱包后追加），Phantom / Solflare / Backpack 均实现。
- **自定义 RPC 一律按 `solana:mainnet` 上报 chain id**：低估网络会让钱包签出「看起来合法、实际在错误网络」的交易；自定义端点多数是主网代理。
- **§10.6 的两个硬约束仍然成立**：mint 初始空间必须恰好等于当前扩展大小（kit 里是 `getMintSize([MetadataPointer])`），租金按最终尺寸 `[MetadataPointer, TokenMetadata]` 付。这是 Token-2022 **程序**的行为，与前端 SDK 无关。
- **构建配置变更**：`tsconfig.json` 的 `target` 从 ES2017 提到 ES2020（kit 使用 BigInt），切主网前需确认目标浏览器兼容性。

### 11.3 验证状态与遗留风险

| 验证项 | 状态 |
|---|---|
| 后端 `fmt` / `clippy` / 93 passed + 1 ignored | ✅ |
| 前端 `tsc` / `lint` / `next build`（14 页）/ 38 suites 268 tests | ✅ |
| Playwright CT 真 Chromium：6 tests（含钱包会话） | ✅ 见 §12.2 |
| kit 离线探针：构造 → 部分签名 → 编码 202B → 解码取签名 / base64 roundtrip | ✅ |
| kit 版 Devnet 真机铸造 | ✅ 2026-11-08 通过，见 §11.4 |
| Wallet Standard 会话层（真实注册表 → 连接 → 签名 → 真机铸造） | ✅ 2026-11-08 通过，见 §12.2 |
| 钱包返回交易的广播前完整性校验 | ✅ 11 个单测 + 真机未误伤，见 §12.1 |
| 浏览器端到端：真实 UI → Wallet Standard 连接 → 浏览器内 Ed25519 签名 → 广播 → 链上核验 | ✅ 2026-11-09 通过，见 §13 |
| **Phantom 扩展本身的解锁 / 批准 UI** | ❌ **仍待人工**：扩展弹窗无法可靠自动化；按 §12.3 清单确认 |

### 11.4 kit 版 Devnet 实测（2026-11-08）

用 `apps/web/scripts/nft-live-probe.mts` 调用**真实的 `mintRoseNft`** 在 Devnet 铸了一枚；钱包环节由本地 Devnet 密钥对模拟（解码 wire → 对 `messageBytes` 追加 payer 签名 → 重新编码）。指令构造、租金计算、广播、finality 轮询全部走生产代码。

| 项 | kit 版实测 | 旧 web3.js 版（§10.6） |
|---|---|---|
| mint 地址 | `EQLqnjK22yuzz83FkTUstB4Gt9qp9kPmxjZQ4qXYKNKj` | `Dhs11iijzktgppnv8aUa9fn9eosSjxxhpzyYuChF5DRv` |
| mint 账户 | **513 字节** / 3,256,280 lamports | 525 字节 / 3,317,240 lamports |
| ATA | 170 字节 / 1,513,840 lamports（`amount=1`） | 170 字节 / 1,513,840 lamports |
| 交易大小 | 809 字节（上限 1232） | 818 字节 |
| 手续费 | 10,000 lamports（2 个签名） | 10,000 |
| **总花费** | **4,780,120 lamports ≈ 0.00478 SOL** | 4,831,080 ≈ 0.00483 SOL |

余额差 4,780,120 = mint 租金 + ATA 租金 + 手续费，账目闭合。**513 与 525 的 12 字节差异来自元数据内容长度不同**（寄语 / roseId 不一样），不是 SDK 差异 —— §10.6 的 525 字节不是常量，成本随寄语长度变化，按 `(128 + 实际 size) × 5080` 计算即可。

链上读回（`jsonParsed` / `finalized`）：`owner=TokenzQd…`（Token-2022）、`decimals=0`、`supply="1"`、`mintAuthority=null`、`metadataPointer` 指向 mint 自身、`updateAuthority`=付款钱包、`additionalMetadata=[["roseId",…],["message",…]]`。后端 live 测试 `routes::solana_nft::tests::live_mint_verifies` 用该 mint **核验通过**。

探针也验证了上一轮最担心的假设：钱包签名前 wire 上已有 **1 个签名**（mint 账户），追加 payer 签名后广播成功 —— `partiallySignTransactionMessageWithSigners` + 钱包追加签名的组合在 kit 下成立。

复跑（会真实花费 Devnet SOL，脚本末尾会打印后端 live 测试所需的 `SOLANA_NFT_*` 变量）：

```bash
cd apps/web
SOLANA_KEYPAIR=~/.config/solana/id.json pnpm verify:solana-nft
```

已连续复跑四次（后三枚 mint `8if2tejLzd7LUAawMywbr2uJHJnZTb9NgMzPj44scgJQ`、`GDc1AFbjcjzMKjGvCAwtxdXSKV3pxG5idocy9JLLNErh`、`Dw9oP9YtKa1GBht8oXdAPewESAMCHcQccn42hNaY5nNa`），账户尺寸、交易大小与花费每次完全一致，后端 live 核验均通过；第三次是脚本最终形态（`setGlobalDispatcher` 取代覆盖 `globalThis.fetch`）后的验证，**第四次把探针升级为走真实 Wallet Standard 会话层**（见 §12.2）。脚本带**主网护栏**：RPC 不含 `devnet` 且未显式设置 `ALLOW_MAINNET=1` 时直接拒绝运行（已实测：拒绝、且未广播任何交易）。

---

## 12. 钱包签名的安全边界与会话层验证（2026-11-08）

### 12.1 广播前先验钱包返回的交易

Wallet Standard 的 `solana:signTransaction` 规范明确允许钱包**返回一笔被修改过的交易**（原文：`Returning a transaction rather than signatures allows multisig wallets, program wallets, and other wallets that use meta-transactions to return a modified, signed transaction`）。对普通转账没问题，对本项目不行：mint 密钥对在浏览器里生成、本地签完就丢弃，那枚签名只绑定**当时那串 message bytes**。钱包一旦重建交易或丢掉签名，这笔交易必然失败，而用户只会看到 RPC 一句含糊的 `signature verification failure`。

现在 `lib/transaction-guard.ts` 在**广播之前**做纯函数校验，任一不满足就抛中文错误、**零广播零扣费**：

| 检查 | 理由 |
|---|---|
| `messageBytes` 与交给钱包前逐字节一致 | 签名绑定具体消息；被改则 mint 签名必然失效 |
| 所有已有签名原样保留（至少含 mint） | 钱包只能**追加**签名，不能丢弃；允许 multisig 追加 |
| 付款钱包地址出现非空签名 | 确认钱包确实签了，而不是原样退回 |

原先只在 `sendSignedTransaction` 抛错后用正则猜「是不是丢了签名」，属于事后兜底；现在主防线前置，正则保留为二次防线。11 个单测覆盖「改消息 / 丢 mint 签名 / 改签名字节 / 丢其他签名 / 钱包没签 / 本地就没签 / multisig 追加」等分支；第四次 Devnet 真机证明它**不误伤正常钱包**。

### 12.2 会话层与真浏览器验证

| 层 | 做法 | 结果 |
|---|---|---|
| 注册表集成 | 新增 `wallet-session.test.ts`：用真实 `getWallets().register()` 注册符合规范的钱包，跑 `connectSolanaWallet()` 全链路（发现 / Phantom 优先 / 过滤非 Solana 钱包 / connect / 签名 / disconnect / 各缺失能力） | ✅ 9 例 |
| Devnet 真机 | `nft-live-probe.mts` 改为注册一个真实 Wallet Standard 钱包，再用**生产 `connectSolanaWallet()`** 拿到 session 交给 `mintRoseNft`；密钥签名由本地 Devnet keypair 完成 | ✅ mint `Dw9oP9Yt…`，后端 `live_mint_verifies` 通过，`chain=solana:devnet` |
| 真浏览器 | 新增 Playwright CT `wallet-session.pw.tsx`：在 Chromium 里用扩展真实使用的 `wallet-standard:app-ready` 事件注入钱包，点击真实会员「连接钱包」按钮 | ✅ CT 共 6 tests 全过 |

两个踩过的坑（都已写进代码注释）：

1. **注册表会有两份实例**。tsx 下探针的 ESM `import "@wallet-standard/app"` 与 `lib/wallet.ts` 编译后的 CJS 副本各自维护钱包列表，注册进 A 则 B 看不到（首次实跑直接报「注册表未发现探针钱包」）。解法：`lib/wallet.ts` 导出 `getWalletRegistry()`，集成工具一律通过会话层自己的实例注册，不再自行 import。
2. **Playwright CT 的 `addInitScript` 太晚**。CT 的 `page` fixture 拿到时页面已导航过，init script 不会再执行（首次 CT 因此连不上钱包）。解法：挂载后用 `page.evaluate` 安装 `app-ready` 监听器 —— `getWallets()` 是点击连接时才惰性调用的，监听器赶得上。

### 12.3 仅剩的人工手测：Phantom 扩展

本机**已安装** Phantom 扩展，但扩展的解锁与批准弹窗无法可靠自动化，因此这一项仍须由人在浏览器里点一遍。好消息是：除「扩展自身 UI」外的整条链路（会员面板 → 连接 → 浏览器内签名 → 广播 → 链上核验）已由 §13 的自动化 E2E 跑通，手测重点因此收窄为「Phantom 是否按预期连接、是否返回未改动的已签交易」。以下清单可直接照做（**全程 Devnet，不碰真 SOL**）：

**前置**

1. Chrome / Brave 安装 Phantom，钱包网络切到 **Devnet**，账户里有测试 SOL（没有就用 devnet 水龙头）。
2. 前后端 RPC 指向同一个 Devnet 端点：前端 `NEXT_PUBLIC_SOLANA_RPC_URL`、后端 `SOLANA_RPC_URL`（后端不设会返回 503，链上核验做不了）。
3. 启动后端与 `apps/web`，打开一朵**公开**玫瑰的详情页（私有玫瑰不出现 NFT 区块）。

**步骤与观察点**

| # | 操作 | 期望 |
|---|---|---|
| 1 | 点「会员」→「连接钱包」 | Phantom 弹出授权；页面显示钱包地址。若报「未检测到 Solana 钱包」，说明扩展未注入或被拦 |
| 2 | 轻量存证：填 roseId + 一句话 → 上链 | 五步进度走完，给出交易签名与区块浏览器链接；后端 `GET /api/rose/{id}/solana` 有记录 |
| 3 | 铸造 NFT：点「铸成 NFT」 | Phantom 弹窗应显示**一笔交易**（不是多笔）；批准后在区块浏览器看到 `supply=1`、`decimals=0`、`mintAuthority=null`、Token-2022 扩展含 roseId / message |
| 4 | 回到详情页刷新 | 页面显示已保存的 mint 地址，后端 `GET /api/rose/{id}/solana/nft` 返回记录 |
| 5 | 故意制造一次后端保存失败（如停掉后端再点） | 页面给出「重试保存」，点它只重发 POST，**不会重复广播 / 不会铸第二枚** |

**三个重点风险，手测时要盯紧**

- **chain id**：代码传 `chain: "solana:devnet"`（规范里该字段可选）。若 Phantom 报「不支持该网络」，先把钱包切到 Devnet 再试；仍失败则需评估去掉 `chain` 参数（代价是失去签错网的提示）。
- **保留 mint 签名**：若页面出现「钱包丢失或改动了 mint 账户已附加的签名；本次未广播、未扣费」，说明该钱包会重建交易 —— 属于 §12.1 拦下的预期行为，换最新版 Phantom 再试。
- **交易被重建**：若出现「钱包返回了与待签内容不同的交易」，同上，不要反复重试，记录钱包版本。

手测通过后把 §11.3 最后一行改成 ✅ 并注明 Phantom 版本与日期，才具备「合主线 / 切主网」的验证条件。主网另需付费 RPC、真 SOL，以及 x402 付费路径与会员模式打通。另注意：devnet / testnet 的 `requestAirdrop` 在 2026-11-08 实测已返回 410（水龙头停服），手测所需测试 SOL 需自备；自动化替代方案见 §13。

## 13. 浏览器端到端验证闭环（2026-11-09）

### 13.1 结论

`pnpm verify:phantom:local` → ✅ **PHANTOM E2E PASSED**。真实 Chromium 打开生产构建的 App → 点「🌐 会员」→「连接钱包」→ 浏览器内用 WebCrypto Ed25519 对 Memo 交易签名 → 广播到**本地 `solana-test-validator`** → `getTransaction(jsonParsed)` 核验 `app=roselet`、`roseId` 一致、`meta.err=null`、fee payer = 已连接钱包。

这把 §11.3 中「除扩展弹窗外」的所有环节从代码推断变成实测。**Phantom 扩展自身的解锁 / 批准 UI 仍需 §12.3 人工手测**。

### 13.2 为什么最终采用这套方案

| 尝试 | 结果 | 结论 |
|---|---|---|
| 真 Devnet + `requestAirdrop` | `410 Gone`；devnet / testnet / 多个第三方 RPC 均停服 | 公网 faucet 已废，测试钱包注资通道不可用 |
| `--load-extension` 加载 MV3 假 Phantom | 扩展不加载（`__fakePhantomAddress=null`），headful / headless 皆然 | 改用 `page.addInitScript` 在 MAIN 世界注入同一个 Wallet Standard 钱包 |
| `next dev` + Playwright | 27 个 JS chunk 全部 200、无异常，但 React 不挂载；Turbopack HMR websocket `ERR_INVALID_HTTP_RESPONSE`，mock 掉 HMR 后仍不 hydration | 换 `next build` + `next start`：生产构建 hydration 正常，也更贴近线上 |
| 本地验证器默认 genesis | 交易落块但执行返回 `ProgramAccountNotFound` | 默认不含 SPL Memo 程序；从 devnet `solana account` 导出 executable account，用 `--account` 在 genesis 加载 |

最终链路完全自包含：不碰外网 faucet、不花真 SOL、无需后端 `localhost:3001`（广播在浏览器内完成，后端只负责记账；E2E 直接以链上数据为真相来源，不依赖 UI 成功文案）。

### 13.3 E2E 揪出的真实 bug：Memo 程序 ID 前后端不一致

- `@solana-program/memo` 的 `getAddMemoInstruction()` 默认程序地址是 **`Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH`**；
- 但 `crates/backend/src/routes/solana_onchain.rs` 的核验白名单只认 **`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`** / `MemoSqLa…`；
- `src/lib/rose-memo.ts` 虽导出并注释了 `MEMO_PROGRAM_ADDRESS`，却没传给指令构造器 → **前端实际发出的交易会被后端链上核验拒绝**。这不是测试环境问题，是生产路径 bug。

**已修**：`getAddMemoInstruction({ memo, signers }, { programAddress: MEMO_PROGRAM_ADDRESS })`，显式钉到后端白名单认可的官方 SPL Memo 程序。

### 13.4 假钱包实现的三个坑

1. **交易线格式**：签名数 compact-u16 从**第 0 字节**开始；v0 的 `0x80` 版本前缀在 **message 内部**，不在交易首字节。按「首字节判 legacy / versioned」或从 offset 1 读签名数，都会让账户表整体错位 → `myIndex=-1` → 返回未签名交易 → kit 报 `#5663012 FEE_PAYER_SIGNATURE_MISSING`。
2. **固定密钥**：WebCrypto `importKey("raw", …)` 只支持 Ed25519 **公钥**；导入私钥会抛错并静默 fallback 到随机密钥，导致预注资地址每次对不上。改用 PKCS#8 私钥 + `exportKey("raw")` 取公钥，地址固定为 `2X3N2CD…`。
3. **签名归属**：签名写入 `myIndex * 64` 处（fee payer 通常是账户表第 0 项），且必须覆盖**完整 message（含版本前缀）**。

### 13.5 新增交付物

| 文件 / 入口 | 作用 |
|---|---|
| `apps/web/scripts/phantom-e2e.mts`、`pnpm verify:phantom` | E2E 主体；自动探测真 Phantom 扩展，找不到则注入假钱包；主网 RPC 需 `ALLOW_MAINNET=1` 才放行 |
| `apps/web/scripts/fake-phantom-extension/` | Wallet Standard 假钱包，真实 WebCrypto Ed25519 签名；可作 MV3 扩展加载，也可由 E2E 注入 |
| `apps/web/scripts/phantom-e2e-local.sh`、`pnpm verify:phantom:local` | 一键闭环：导出 Memo 程序账户 → 起本地验证器并注资 → 生产构建 → 起服务 → 跑 E2E |
| `next.config.ts` 的 `E2E_SKIP_TYPECHECK` | 默认关闭；仅 E2E 置 1，跳过受限沙盒里会挂住的 build 内 tsc，独立 `pnpm typecheck` 仍是权威门禁 |

### 13.6 已知环境限制

本轮执行沙盒里 `pnpm typecheck` / `jest` 会在 TypeScript worker 处超时，`next build` 会触发批量删除保护（`.next/trace`）——均属执行环境限制；生产构建本体编译成功且 E2E 通过。合主线前应在正常开发机重跑 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`。

### 13.7 防回归：跨语言常量契约测试

§13.3 的 Memo 程序 ID 漂移不是第一次：DEVLOG 2026-11-07 已记过一次同类问题（前端组件直接写 `MemoSqLa…`）。根因是 Rust 与 TS 各写一份字符串，编译器无法交叉校验。为此在 `crates/backend/src/routes/solana_onchain.rs` 的 `mod tests` 增加 `frontend_memo_contract_matches_backend`：测试运行时读 `apps/web/src/lib/rose-memo.ts`，逐项断言——

1. `MEMO_PROGRAM_ADDRESS` 落在后端 `MEMO_PROGRAM_IDS` 白名单内，且等于首选（canonical）ID；
2. `getAddMemoInstruction` 调用点显式传入 `programAddress:` 并引用共享常量，**专门防默认值回归**；
3. `app` 标签与 `MEMO_APP_TAG` 一致、`roseId` 字段名与解析器读取的键一致；
4. 行为级校验：按前端 interface 形状构造的 memo 能被 `parse_rose_memo()` 接受。

配套把 `app` / `roseId` 键名提为后端常量 `MEMO_APP_FIELD` / `MEMO_ROSE_ID_FIELD`，让测试引用后端唯一事实来源而非复制字面量；生产逻辑零行为变化，不加依赖、不改模块可见性。

**故意破坏验证**：改程序 ID、删 override、改 app tag、改字段名，4 种漂移均使测试失败；恢复后通过，前端文件无残留。门禁 `cargo fmt --all -- --check` / `cargo clippy -p roselet-backend --all-targets -- -D warnings` / `cargo test --workspace --lib` 全绿（backend 94 passed + 1 ignored；recommend 153 passed）。

> 补充：初稿提到的 `crates/recommend/src/goat.rs:125` 既有 `useless_format` 已在本轮清理——那个 `format!` 没有占位符、只有 `{{` / `}}` 转义，改成普通 `&str` 字面量时必须同步把花括号反转义，否则会产出非法 JSON；已用脚本比对新旧字符串逐字相等，并单独跑该测试通过。至此 `cargo clippy --workspace --all-targets --all-features --tests --benches -- -D warnings`（CLAUDE.md 规定的严格口径）`RC=0`。
>
> 仍待单独决定：CI（`.github/workflows/build.yml`）与 pre-commit 用的是 `cargo clippy --all-features -- -D warnings`，**不含 `--all-targets`**——这正是测试代码里的 lint 债务能长期存在的原因。是否把 CI 口径收紧到 CLAUDE.md 的严格版，需评估对其他贡献者的影响后再定。

---

*本评估基于 `main` @ `7b53fb9` 的代码事实核查，随实现演进需同步更新。*
