# 钱包连接方案评估：三次外部链接，一个结论

> 生成日期：2026-11-19。起因：用户连续发来三个钱包相关链接，逐条查证后统一留档，避免日后重复评估。
> 范围：RainbowKit、Solana 官方 Next.js 指南、Helius「Solana 嵌入式钱包」文章。
> 一句话结论：**三条链各用各的适配器就是当前最优解；外部方案要么只管一条链、要么和「普通用户零 Web3」门闩冲突，都不接。**

---

## 0. 先记住项目的三条链（判断的地基）

| 链 | 干什么用 | 现在怎么连 | 面向谁 |
|---|---|---|---|
| Solana Devnet | 会员版上链主力 | 手写 Wallet Standard 多钱包选择器（Phantom/Solflare/Backpack…）+ 自动重连 | 会员 |
| Aleo | 私密 Vault | Leo Wallet 适配器 | 会员 |
| Base Sepolia（EVM） | 链上纪念版 | viem 直读 `window.ethereum` | 会员 |

**产品门闩（2026-11-18 用户拍板）**：普通用户全程零 Web3 痕迹；钱包、上链只在会员版出现。主流程「写三句玫瑰 → 种下 → 一周后回来看」根本不需要钱包。

---

## 1. 三次评估一览

| 链接 | 它是什么 | 能覆盖我们的链吗 | 结论 |
|---|---|---|---|
| RainbowKit（`rainbowkit.com`） | 以太坊生态的钱包连接 UI，底层 wagmi + viem | 只管 EVM 一条（纪念版）；碰不到 Solana / Aleo | ❌ 不用 |
| Solana 官方 Next.js 指南（`solana.com/docs/frontend/nextjs-solana`） | 官方新 Kit 路线：Wallet Standard + `@solana/kit`，配 `@solana/kit-plugin-wallet` | 底层和我们手写方案**是同一条路**；只比我们多一个「自动重连」 | ✅ 方向一致；已补自动重连（`c9854f4`） |
| Helius「嵌入式钱包」文章（`helius.dev/zh/blog/solana-embedded-wallets`） | **Dynamic 软文**（作者是 Dynamic 员工）：邮箱/社交注册即自动获得链上钱包 | 靠 Dynamic SDK 商业服务；能连 Solana，但和门闩方向相反；Aleo 支持见下方说明 | ❌ 不接 |

---

## 2. 逐个说清为什么

### RainbowKit：只管一条道

它是「以太坊生态」的钱包插件，只认 MetaMask / Coinbase / WalletConnect 这类 EVM 钱包。我们三条链里它只能碰纪念版那条（还是边缘功能），主力的 Solana、Aleo 完全够不着。用它等于给边缘功能换皮，收益对不上成本。

### Solana 官方指南：没走弯路，只补了一小块

- 官方文档明确有两条路：旧办法（web3.js v1 + wallet-adapter，已标 legacy）、新 Kit 路线（Wallet Standard + `@solana/kit`）。我们当初直接选了新的 Kit 路线，和官方现在主推的一致，kit 版本比模板还新。
- 唯一真实差距是「自动重连」。已在 `c9854f4` 用**零新增依赖**补上：主动连过的钱包名记入 localStorage，进会员模式时静默连回（`silent: true`），断开清记忆；普通用户绝不触发钱包调用。真浏览器闭环已验证上线。
- 整体切官方插件不值：要重写 discovery/connect + 一整套测试守卫，换来「代码更官方」和那个已经补上的自动重连。

### 嵌入式钱包（Helius/Dynamic 文章）：方向相反

- **本质**：Dynamic 的宣传文，全文只推 Dynamic SDK + Helius RPC。它说的「嵌入式钱包」= 用户邮箱/社交一注册，后台自动生成钱包，用户无感。
- **它解决的痛点在我们这不成立**：嵌入式钱包是给「钱包是必经门槛、用户没钱包就流失」的应用用的。Roselet 主流程写玫瑰根本不需要钱包，没有这个流失点。
- **和门闩冲突**：它把钱包塞进入口、人人都有；我们刻意让普通用户零 Web3、只有会员版才显式出现。硬塞等于撬开门闩。
- **用户群不对路**：文章主打邮箱 / X / Telegram 登录，我们是社区居民、微信生态。
- **若真要「一个组件连所有链」**：查下来只有 Dynamic 一家把 Aleo 列为一等公民（有 `@dynamic-labs/aleo`），Solana + Aleo + EVM 全包，但商业收费、迁移成本几百行，且与门闩定位相反。Reown AppKit 不支持 Aleo，做不到通吃。

---

## 3. 当前最优解（维持不变）

1. Solana：手写 Wallet Standard 多钱包选择器 + 自动重连，链仍 Devnet。
2. Aleo：Leo Wallet 适配器；多钱包当时用户拍板暂缓。
3. EVM 纪念版：viem 直读。
4. 门闩守住：普通用户零 Web3，钱包只在会员版出现。

没有真实的连接失败痛点要救，就不为「UI 统一 / 代码更官方」引入商业 SDK 或大重构。

---

## 4. 什么时候该重新评估（触发条件）

- 决定做「会员版统一钱包中心」并接受商业 SDK 成本 → 再拿 Dynamic 做整体方案评估。
- Aleo 从暂缓转为要做多钱包 → 重新评估 Aleo 侧适配器。
- 用户验证（5 人试用）反馈「连接钱包这一步劝退」→ 才考虑更顺滑的引导方案。

在此之前，三次评估的结论均为「不改代码」。
