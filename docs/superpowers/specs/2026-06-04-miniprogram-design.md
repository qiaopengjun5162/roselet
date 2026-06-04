# Roselet 微信小程序 — 架构设计文档

**日期**：2026-06-04  
**状态**：已确认，待实现

---

## 1. 背景与目标

Roselet 现有一套 Web 端（Next.js 15 + Rust Axum 后端），核心功能完整。本阶段目标是将产品延伸到微信小程序，触达更广泛的中国用户群体，同时为未来 Web3 功能（Solana/Ethereum 双链）预留架构空间。

**约束**：
- 小程序主包体积上限 2MB
- 微信运行时无 DOM、无 `window`/`document`/`localStorage`
- WASM 必须通过 `WXWebAssembly`（非标准 `WebAssembly`）加载
- 只能加载本地代码包内的 `.wasm` 文件
- 微信小程序无 `TextEncoder` / `TextDecoder`，需 polyfill

---

## 2. 总体架构

```
roselet/
├── apps/
│   ├── web/              # 现有 Next.js 15 前端（不变）
│   └── miniprogram/      # 新增 Taro 小程序（React + TS）
├── packages/
│   └── core/             # 新增：跨端共享层（TS 类型 + 纯逻辑）
├── crates/
│   ├── backend/          # Rust Axum 后端（两端共用同一套 API）
│   └── recommend/        # Rust WASM 模块（两端共用）
└── scripts/
    └── patch-wasm.js     # 新增：wasm-bindgen 输出补丁脚本
```

### 双引擎模型

| 层 | 技术 | 职责 |
|----|------|------|
| 渲染层 | Taro 4（React + TypeScript） | UI 组件、路由、动画、用户交互 |
| 共享逻辑层 | `packages/core`（TypeScript） | 类型定义、纯业务逻辑、API 数据契约 |
| 计算层 | Rust → WASM（`crates/recommend`） | 情绪分析、推荐算法；未来：链上签名 |
| 服务层 | Rust Axum（`crates/backend`） | REST API（小程序与 Web 共用） |

---

## 3. 各层详细设计

### 3.1 `packages/core` — 共享层

**包含内容：**
- TypeScript 接口：`Rose`、`User`、`AuthResponse`、`PaginatedResponse`、`UserProfile`、`LikeResponse`（从 `apps/web/src/lib/api.ts` 提取）
- API 数据契约（请求 body / 响应 shape），不含任何网络调用实现
- 纯逻辑工具（不依赖任何宿主环境 API）
- Web3 扩展接口（MVP 阶段为空接口，不实现，见第 6 节）

**不包含：**
- 任何 UI 组件
- 任何对 `fetch`/`wx.request`/`window`/`localStorage` 的调用
- 任何平台特定的路由逻辑

### 3.2 `apps/miniprogram` — Taro 小程序

**框架**：Taro 4.x（React 模式，TypeScript）  
**渲染器**：默认 WebView（Skyline 作为后续性能优化项，不列入 MVP）  
**样式**：Taro 原生 CSS Modules + 手写深空霓虹主题（shadcn 不可用）

**页面路由（MVP）：**

| 路径 | 功能 |
|------|------|
| `/pages/index` | 首页：规则介绍 + 进入按钮 |
| `/pages/login` | 昵称注册 + JWT 获取 |
| `/pages/garden` | 花圃：分页列表 + 颜色筛选 |
| `/pages/plant` | 种花：三字段输入 + 提交 |
| `/pages/rose/[id]` | 玫瑰详情：内容 + AI 回复展示 |

**存储**：`wx.setStorageSync`/`wx.getStorageSync` 替代 `localStorage`  
**网络**：封装 `wx.request` 为 Promise，对齐 `packages/core` 的 API 接口契约

### 3.3 Rust WASM 接入

这是整个技术栈最复杂的部分，核心是"欺骗" wasm-bindgen 生成的胶水代码，让它在微信环境下正常运行。

**构建流程：**

```bash
# Step 1：编译（target=web 生成可手动控制初始化的胶水代码）
cd crates/recommend
wasm-pack build --target web --out-dir ../../apps/miniprogram/pkg

# Step 2：补丁（脚本自动完成）
node scripts/patch-wasm.js
# - 将胶水 JS 中所有 WebAssembly → WXWebAssembly
# - 注入 TextEncoder/TextDecoder polyfill 引用
# - 替换 fetch-based init 为 WXWebAssembly.instantiate

# Step 3：wasm 文件由 Taro config copy 插件直接复制到 dist/
```

**微信端 WASM 加载器（`apps/miniprogram/src/utils/wasm.ts`）：**

```typescript
import * as wasmBindgen from '../../pkg/roselet_recommend.js';

let initialized = false;

export async function initWasm(): Promise<boolean> {
  if (initialized) return true;
  try {
    // 使用微信原生 API 加载，路径相对小程序根目录
    const result = await WXWebAssembly.instantiate(
      '/pkg/roselet_recommend_bg.wasm',
      { './roselet_recommend_bg.js': wasmBindgen }
    );
    wasmBindgen.__wbg_set_wasm(result.instance.exports);
    initialized = true;
    return true;
  } catch {
    return false; // 降级：不阻断主功能
  }
}
```

**Taro config 中的 copy 配置（`apps/miniprogram/config/index.ts`）：**

```javascript
copy: {
  patterns: [
    {
      from: 'pkg/roselet_recommend_bg.wasm',
      to: 'dist/pkg/roselet_recommend_bg.wasm'
    }
  ]
}
```

**Polyfill（`apps/miniprogram/src/polyfill.ts`，在 `app.tsx` 第一行引入）：**

```typescript
import { TextEncoder, TextDecoder } from 'text-encoding';
// @ts-ignore
if (typeof global !== 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
```

**WASM 在 MVP 中的用途**：种花页面的智能颜色/主题推荐（`recommend()`），失败时静默降级，不阻断主流程。

---

## 4. 代码共享边界

| 资产 | Web（Next.js） | 小程序（Taro） | 共享方式 |
|------|---------------|---------------|---------|
| TypeScript 类型 | ✓ | ✓ | `packages/core` |
| Rust WASM 模块 | ✓ | ✓ | `crates/recommend`（分别构建产物） |
| 后端 REST API | ✓ | ✓ | 同一个 `crates/backend` |
| UI 组件 | shadcn（Web） | Taro 原生 | **不共享** |
| 网络调用层 | `fetch` | `wx.request` | **不共享**，各自封装 |
| 路由 | Next.js App Router | Taro Router | **不共享** |
| 本地存储 | `localStorage` | `wx.Storage` | **不共享** |

---

## 5. MVP 功能范围

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 昵称注册 + JWT 认证 | P0 | |
| 花圃浏览（分页 + 颜色筛选） | P0 | |
| 种一朵玫瑰（三字段） | P0 | |
| AI 回复展示 | P0 | 情感闭环核心，不可省略 |
| WASM 推荐（种花页） | P1 | 失败静默降级 |
| 点赞 | P2 二期 | |
| 个人花圃 / 资料页 | P2 二期 | |
| 情绪示波器 | P3 | |

---

## 6. Web3 接口预留

`packages/core/src/web3.ts`（MVP 阶段仅定义接口，不实现）：

```typescript
export interface WalletAdapter {
  connect(): Promise<string>;
  signMessage(msg: Uint8Array): Promise<Uint8Array>;
  disconnect(): Promise<void>;
}

export interface ChainAdapter {
  wallet: WalletAdapter;
  submitRose(content: string, color: string): Promise<string>; // 返回 tx hash
}
```

未来新增 `crates/chain-core`，负责 Ed25519 签名和 Solana 交易构建，通过相同的 WASM 接入机制加载。

---

## 7. Monorepo 工程配置

**pnpm workspace** 新增条目：
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'   # 新增
```

**justfile 新增任务：**
```
wasm-mini   # wasm-pack build + patch-wasm.js
miniprogram # Taro 开发模式（微信）
miniprogram-build # Taro 生产构建
```

**CI**：frontend job 新增 Taro 构建步骤（`pnpm --filter miniprogram build`）

---

## 8. 实现顺序

1. **验证 WASM 桥接 Demo**：在微信开发者工具里跑通 `WXWebAssembly.instantiate` + `recommend()` 调用，证明技术路径可行（最高风险项，优先验证）
2. **搭 `packages/core`**：从 `apps/web/src/lib/api.ts` 提取共享类型
3. **Taro 项目初始化**：接入 `packages/core`，配置 `wx.request` 封装，写 polyfill
4. **逐页实现 P0 功能**：login → garden → plant → rose detail（含 AI 回复）
5. **集成 WASM 推荐**：种花页接入，加降级处理
6. **体积审计**：确认主包 < 2MB，必要时分包加载 WASM
