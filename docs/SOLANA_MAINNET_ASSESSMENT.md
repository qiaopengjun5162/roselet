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

### 9.1 三条上链路线的真实成本（修正版）

前一版只算了 mint + metadata，**漏了 Master Edition 账户**，特此修正。按 `3480 × (128 + data_len) × 2` 实算（rent 为押金、关账户可退）：

| 路线 | 链上账号 | 租金押金 | 手续费 | 合计现金流 |
|---|---|---|---|---|
| **A. Memo 存证**（现状） | 无（不创建账号） | **0** | 5000 lamports + 优先费 | **≈ 0.000005 SOL** |
| **B1. Token-2022 NFT** | mint（≈151 B，含 MetadataPointer）+ 内联元数据（≈180 B）+ ATA（165 B） | ≈ 0.0032 + 0.0020 | 少量 | **≈ 0.0052 SOL/朵** |
| **B2. Metaplex NFT** | mint(82) + ATA(165) + MetadataV3(≈679) + MasterEdition(≈282) | ≈ 0.0015+0.0020+0.0056+0.0029 | 少量 | **≈ 0.012 SOL/朵** |
| B3. 压缩 NFT（cNFT） | 无独立账号，挂在 Merkle tree 上 | 极低 | 极低 | ≈ 0.00001 SOL/朵（**本地无先例**，需 tree + DAS 索引器） |

即：Memo 比 Token-2022 便宜约 **1000 倍**，比 Metaplex 便宜约 **2400 倍**。
两个 NFT 方案的具体 lamports 由程序自己 `msg!("... lamports required")` 打日志，实跑一次即可得到精确值（`shenqi-box/programs/token_2022_nft/src/lib.rs:72-77`）。

### 9.2 由此调整的建议

1. **只为「确权 / 存证」**：继续 Memo，不要为省钱而迁就 NFT；两者解决的不是同一个问题。
2. **若确实要让玫瑰成为可转让资产**：选 **B1 Token-2022**，直接复用 `shenqi-box` 的程序结构与测试，只需把 `name/symbol/uri` 换成本朵玫瑰的元数据（`uri` 用已上传的 IPFS CID）。
3. **除非要上 Magic Eden 等二级市场**，否则不要选 B2 Metaplex——多付一倍租金，换来的是生态兼容性。
4. **前端不需要迁移 SDK**：`solana_forge` 已证明 web3.js 能覆盖当前需求；`@solana/kit` 只在需要更强类型/可组合性时再考虑。
5. **数据要可查询时再引入索引器**：`solana-event-indexer` 的「扫块 + 解析 + Postgres」结构与本项目后端同栈（Rust + sqlx），可低成本移植。

---

*本评估基于 `main` @ `7b53fb9` 的代码事实核查，随实现演进需同步更新。*
