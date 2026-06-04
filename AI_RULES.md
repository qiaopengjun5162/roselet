# Roselet 跨端开发铁律

## 架构
- Next.js 15 (Web) + Taro 4 (小程序) + Rust WASM，Monorepo
- `packages/core` = 唯一共享层：类型、主题、Hooks、API 逻辑

## 强制规则

### 1. 禁止硬编码颜色
```typescript
// ❌ <View style={{ background: '#0a0b14' }}>
// ✅ import { theme } from '@roselet/core'; style={{ background: theme.color.bg }}
```
修改视觉必须改 `packages/core/src/theme/index.ts` 的 Token。

### 2. 逻辑先抽后用
- 状态管理（filter、pagination）→ `packages/core/src/hooks/`
- API 调用、数据转换 → `packages/core` 内统一
- 禁止在 `apps/*` 里裸写业务 `useEffect`/`useState`

### 3. 小程序安全区
- 所有小程序页面必须使用 `NavBar` 组件
- `navigationStyle: 'custom'` + `disableScroll: true`
- 页面容器 `paddingTop` 预留 88px+ 给导航栏

### 4. 构建前检查
```bash
just test                    # 271 tests must pass
TARO_APP_ID=xxx just miniprogram-build  # miniprogram must compile
pnpm build                   # web must compile
```

### 5. 修改必须双端同步
改了一端的视觉/逻辑，必须立即检查另一端是否需要同样修改。

## 文件结构
```
packages/core/src/
  theme/index.ts    ← 颜色 Token 唯一真相源
  hooks/            ← 共享业务 Hooks
  types.ts          ← TS 类型定义
  api/              ← 统一 API/合约调用层（待建）

apps/web/           ← Next.js Web 端
apps/miniprogram/   ← Taro 小程序端
crates/recommend/   ← Rust WASM 推荐引擎
