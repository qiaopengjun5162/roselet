# Roselet 微信小程序 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Roselet monorepo 中新增微信小程序（Taro + Rust WASM），共用后端 API，实现"注册 → 花圃 → 种花 → AI 回复"核心闭环。

**Architecture:** Taro 4（React + TS）负责渲染，`packages/core` 共享类型定义，`crates/recommend` WASM 模块经 `scripts/patch-wasm.js` 适配后通过 `WXWebAssembly.instantiate` 加载，网络层用 `wx.request` 封装替代 `fetch`。

**Tech Stack:** Taro 4、React 18、TypeScript、wasm-pack、fast-text-encoding、微信开发者工具

---

## Task 1: pnpm workspace + packages/core 基础类型

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `packages/core/package.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/web3.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1.1: 更新 pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 1.2: 创建 packages/core/package.json**

```json
{
  "name": "@roselet/core",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

- [ ] **Step 1.3: 创建 packages/core/src/types.ts**

```typescript
export interface User {
  id: string;
  nickname: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Rose {
  id: string;
  color: string;
  gratitude: string | null;
  anxiety: string | null;
  hope: string | null;
  user_id: string | null;
  nickname: string | null;
  like_count: number;
  ai_reply: string | null;
  created_at: string;
}

export interface CreateRose {
  color: string;
  gratitude?: string;
  anxiety?: string;
  hope?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface UserProfile {
  user: User;
  total_roses: number;
  red_count: number;
  white_count: number;
  yellow_count: number;
}

export interface LikeResponse {
  liked: boolean;
  like_count: number;
}
```

- [ ] **Step 1.4: 创建 packages/core/src/web3.ts（占位，MVP 不实现）**

```typescript
export interface WalletAdapter {
  connect(): Promise<string>;
  signMessage(msg: Uint8Array): Promise<Uint8Array>;
  disconnect(): Promise<void>;
}

export interface ChainAdapter {
  wallet: WalletAdapter;
  submitRose(content: string, color: string): Promise<string>;
}
```

- [ ] **Step 1.5: 创建 packages/core/src/index.ts**

```typescript
export * from './types';
export * from './web3';
```

- [ ] **Step 1.6: 验证 workspace 识别**

```bash
pnpm install
pnpm ls --filter @roselet/core
```

Expected: 输出 `@roselet/core 0.1.0`

- [ ] **Step 1.7: Commit**

```bash
git add pnpm-workspace.yaml packages/
git commit -m "feat: add packages/core with shared types"
```

---

## Task 2: scripts/patch-wasm.js

**Files:**
- Create: `scripts/patch-wasm.js`

- [ ] **Step 2.1: 先查看胶水代码结构**

```bash
cd crates/recommend
wasm-pack build --target web --out-dir /tmp/wasm-inspect
head -60 /tmp/wasm-inspect/roselet_recommend.js
```

Expected: 看到 `WebAssembly.instantiate` 和 `__wbg_init` 函数

- [ ] **Step 2.2: 创建 scripts/patch-wasm.js**

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pkgDir = path.resolve(__dirname, '../apps/miniprogram/pkg');
const gluePath = path.join(pkgDir, 'roselet_recommend.js');

if (!fs.existsSync(gluePath)) {
  console.error('胶水代码不存在，请先执行 wasm-pack build');
  process.exit(1);
}

let code = fs.readFileSync(gluePath, 'utf8');

// 顺序重要：先替换长的
code = code.replace(/WebAssembly\.instantiateStreaming/g, 'WXWebAssembly.instantiate');
code = code.replace(/WebAssembly\.instantiate\b/g, 'WXWebAssembly.instantiate');
code = code.replace(/WebAssembly\./g, 'WXWebAssembly.');
code = code.replace(/typeof WebAssembly/g, 'typeof WXWebAssembly');

// 在文件头注入 polyfill 引用
const header = "import '../polyfill';\n";
if (!code.startsWith(header)) {
  code = header + code;
}

fs.writeFileSync(gluePath, code);
console.log('patch-wasm: WXWebAssembly 补丁注入成功');
```

- [ ] **Step 2.3: 验证语法**

```bash
node --check scripts/patch-wasm.js
```

Expected: 无输出

- [ ] **Step 2.4: Commit**

```bash
git add scripts/patch-wasm.js
git commit -m "feat: add patch-wasm.js for WXWebAssembly adaptation"
```

---

## Task 3: justfile 新增小程序任务

**Files:**
- Modify: `justfile`

- [ ] **Step 3.1: 在 justfile wasm 任务后添加**

```makefile
# 为小程序构建 WASM（编译 + WXWebAssembly 补丁）
wasm-mini:
    cd crates/recommend && wasm-pack build --target web --out-dir ../../apps/miniprogram/pkg
    node scripts/patch-wasm.js

# 小程序开发模式（微信）
miniprogram:
    cd apps/miniprogram && pnpm dev:weapp

# 小程序生产构建
miniprogram-build:
    cd apps/miniprogram && pnpm build:weapp
```

- [ ] **Step 3.2: Commit**

```bash
git add justfile
git commit -m "chore: add miniprogram build tasks to justfile"
```

---

## Task 4: Taro 项目初始化

**Files:**
- Create: `apps/miniprogram/`（Taro 项目骨架）

- [ ] **Step 4.1: 在 apps/ 目录下创建 Taro 项目**

```bash
cd apps
npx @tarojs/cli@latest init miniprogram \
  --template default \
  --framework react \
  --typescript \
  --css cssmodules
```

交互选项：React、TypeScript、CSS Modules

- [ ] **Step 4.2: 安装依赖**

```bash
cd apps/miniprogram
pnpm add @roselet/core@workspace:*
pnpm add fast-text-encoding
pnpm add -D @types/wechat-miniprogram
```

- [ ] **Step 4.3: 验证结构**

```bash
ls apps/miniprogram/src/
```

Expected: 看到 `app.tsx`、`app.config.ts`、`pages/`

- [ ] **Step 4.4: Commit**

```bash
git add apps/miniprogram/
git commit -m "feat: scaffold Taro miniprogram project"
```

---

## Task 5: polyfill + storage + request 工具层

**Files:**
- Create: `apps/miniprogram/src/polyfill.ts`
- Create: `apps/miniprogram/src/utils/storage.ts`
- Create: `apps/miniprogram/src/utils/request.ts`
- Modify: `apps/miniprogram/src/app.tsx`（顶部加 polyfill import）

- [ ] **Step 5.1: 创建 apps/miniprogram/src/polyfill.ts**

```typescript
import 'fast-text-encoding';
```

- [ ] **Step 5.2: 创建 apps/miniprogram/src/utils/storage.ts**

```typescript
import type { User } from '@roselet/core';

const TOKEN_KEY = 'roselet_token';
const USER_KEY = 'roselet_user';

export function getToken(): string | null {
  return wx.getStorageSync(TOKEN_KEY) || null;
}

export function setToken(token: string): void {
  wx.setStorageSync(TOKEN_KEY, token);
}

export function getUser(): User | null {
  const raw = wx.getStorageSync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    wx.removeStorageSync(USER_KEY);
    return null;
  }
}

export function setUser(user: User): void {
  wx.setStorageSync(USER_KEY, JSON.stringify(user));
}

export function logout(): void {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
}
```

- [ ] **Step 5.3: 创建 apps/miniprogram/src/utils/request.ts**

```typescript
import { getToken } from './storage';

const BASE_URL = 'http://localhost:3001';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  auth?: boolean;
}

export function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', data, auth = false } = opts;
  const header: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) header['Authorization'] = `Bearer ${token}`;
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method,
      data: data ? JSON.stringify(data) : undefined,
      header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
      fail: (err) => reject(new Error(err.errMsg)),
    });
  });
}
```

- [ ] **Step 5.4: 在 app.tsx 顶部加 polyfill import**

在 `apps/miniprogram/src/app.tsx` 最顶部第一行插入：

```typescript
import './polyfill';
```

- [ ] **Step 5.5: Commit**

```bash
git add apps/miniprogram/src/
git commit -m "feat: add polyfill, storage, request utils for miniprogram"
```

---

## Task 6: WASM 加载器 + Demo 验证（最高风险，优先跑通）

**Files:**
- Create: `apps/miniprogram/src/utils/wasm.ts`
- Modify: `apps/miniprogram/config/index.ts`（添加 copy 配置）
- Modify: `apps/miniprogram/src/pages/index/index.tsx`（临时 Demo）

- [ ] **Step 6.1: 构建 WASM 产物**

```bash
just wasm-mini
```

Expected: `apps/miniprogram/pkg/` 下出现已打补丁的 `roselet_recommend.js` 和 `roselet_recommend_bg.wasm`

- [ ] **Step 6.2: 创建 apps/miniprogram/src/utils/wasm.ts**

```typescript
import type { CreateRose } from '@roselet/core';

export interface Recommendation {
  flower_language: { title: string; content: string; keywords: string[] };
  theme: { title: string; content: string; category: string };
  color_suggestion: { color: string; reason: string };
}

interface WasmMod {
  recommend: (json: string) => unknown;
  analyze_text: (text: string) => unknown;
  __wbg_set_wasm: (exports: unknown) => void;
}

let wasmMod: WasmMod | null = null;

export async function initWasm(): Promise<boolean> {
  if (wasmMod) return true;
  try {
    const mod = await import('../../pkg/roselet_recommend') as unknown as WasmMod;
    const result = await WXWebAssembly.instantiate(
      '/pkg/roselet_recommend_bg.wasm',
      { './roselet_recommend_bg.js': mod }
    );
    mod.__wbg_set_wasm(result.instance.exports);
    wasmMod = mod;
    return true;
  } catch (e) {
    console.warn('WASM load failed, degraded mode:', e);
    return false;
  }
}

export function getRecommendation(roses: CreateRose[]): Recommendation | null {
  if (!wasmMod) return null;
  try {
    return wasmMod.recommend(JSON.stringify(roses)) as Recommendation;
  } catch {
    return null;
  }
}
```

- [ ] **Step 6.3: 在 config/index.ts 添加 copy 配置**

在 Taro config 的 weapp 或根对象中加：

```typescript
copy: {
  patterns: [
    {
      from: 'pkg/roselet_recommend_bg.wasm',
      to: 'dist/weapp/pkg/roselet_recommend_bg.wasm',
    },
  ],
  options: {},
},
```

- [ ] **Step 6.4: 临时改首页为 WASM Demo**

```tsx
// apps/miniprogram/src/pages/index/index.tsx
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { initWasm, getRecommendation } from '../../utils/wasm'

export default function Index() {
  const [status, setStatus] = useState('Loading WASM...')

  useEffect(() => {
    initWasm().then(ok => {
      if (ok) {
        const rec = getRecommendation([{ color: 'red', gratitude: '感谢测试' }])
        setStatus(rec ? `WASM OK: ${rec.color_suggestion.color}` : 'WASM loaded, rec null')
      } else {
        setStatus('WASM load failed (degraded)')
      }
    })
  }, [])

  return (
    <View style={{ padding: '40px', background: '#020d1a', minHeight: '100vh' }}>
      <Text style={{ color: '#f43f5e', fontSize: '20px', display: 'block' }}>Roselet</Text>
      <Text style={{ color: '#94a3b8', marginTop: '20px', display: 'block' }}>{status}</Text>
    </View>
  )
}
```

- [ ] **Step 6.5: 在微信开发者工具验证**

```bash
just miniprogram
```

打开 `apps/miniprogram/dist/weapp/`，观察首页文字：
- ✅ `WASM OK: red`（或其他颜色）= 完全通过
- ⚠️ `WASM loaded, rec null` = 加载成功，推荐逻辑问题，继续
- ❌ `WASM load failed` = 检查 patch-wasm.js 替换结果和 wasm.ts import 路径

- [ ] **Step 6.6: Commit**

```bash
git add apps/miniprogram/src/utils/wasm.ts apps/miniprogram/config/ apps/miniprogram/src/pages/index/
git commit -m "feat: add WXWebAssembly loader + WASM demo verification"
```

---

## Task 7: API 层

**Files:**
- Create: `apps/miniprogram/src/api/index.ts`

- [ ] **Step 7.1: 创建 apps/miniprogram/src/api/index.ts**

```typescript
import type {
  AuthResponse, Rose, CreateRose,
  PaginatedResponse, UserProfile, LikeResponse,
} from '@roselet/core';
import { request } from '../utils/request';

export function register(nickname: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', { method: 'POST', data: { nickname } });
}

export function getGarden(page = 1, perPage = 20, color?: string): Promise<PaginatedResponse<Rose>> {
  let path = `/api/garden?page=${page}&per_page=${perPage}`;
  if (color) path += `&color=${color}`;
  return request<PaginatedResponse<Rose>>(path);
}

export function getRose(id: string): Promise<Rose> {
  return request<Rose>(`/api/rose/${id}`);
}

export function createRose(data: CreateRose): Promise<Rose> {
  return request<Rose>('/api/rose', { method: 'POST', data, auth: true });
}

export function getUserProfile(): Promise<UserProfile> {
  return request<UserProfile>('/api/user/profile', { auth: true });
}

export function toggleLike(roseId: string): Promise<LikeResponse> {
  return request<LikeResponse>(`/api/rose/${roseId}/like`, { method: 'POST', auth: true });
}
```

- [ ] **Step 7.2: Commit**

```bash
git add apps/miniprogram/src/api/
git commit -m "feat: add miniprogram API layer"
```

---

## Task 8: Login 页面

**Files:**
- Create: `apps/miniprogram/src/pages/login/index.tsx`
- Create: `apps/miniprogram/src/pages/login/index.module.css`
- Modify: `apps/miniprogram/src/app.config.ts`

- [ ] **Step 8.1: 在 app.config.ts 的 pages 数组里注册所有路由**

```typescript
pages: [
  'pages/index/index',
  'pages/login/index',
  'pages/garden/index',
  'pages/plant/index',
  'pages/rose/index',
],
```

- [ ] **Step 8.2: 创建 apps/miniprogram/src/pages/login/index.tsx**

```tsx
import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { register } from '../../api'
import { setToken, setUser } from '../../utils/storage'
import styles from './index.module.css'

export default function Login() {
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister() {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length > 20) { setError('昵称 1-20 字'); return }
    setLoading(true); setError('')
    try {
      const res = await register(trimmed)
      setToken(res.token); setUser(res.user)
      const pages = Taro.getCurrentPages()
      if (pages.length > 1) Taro.navigateBack()
      else Taro.navigateTo({ url: '/pages/garden/index' })
    } catch {
      setError('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className={styles.container}>
      <Text className={styles.title}>🌹 Roselet</Text>
      <Text className={styles.sub}>起个昵称，开始种花</Text>
      <Input
        className={styles.input}
        placeholder="你的昵称（1-20字）"
        maxlength={20}
        value={nickname}
        onInput={e => setNickname(e.detail.value)}
      />
      {error ? <Text className={styles.error}>{error}</Text> : null}
      <Button className={styles.btn} loading={loading} disabled={loading} onClick={handleRegister}>
        进入花圃
      </Button>
    </View>
  )
}
```

- [ ] **Step 8.3: 创建 apps/miniprogram/src/pages/login/index.module.css**

```css
.container { min-height: 100vh; background: #020d1a; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; }
.title { color: #f43f5e; font-size: 32px; font-weight: bold; }
.sub { color: #94a3b8; font-size: 14px; margin-top: 8px; margin-bottom: 40px; }
.input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 16px; color: #e2e8f0; font-size: 16px; }
.error { color: #f87171; font-size: 13px; margin-top: 8px; }
.btn { width: 100%; margin-top: 24px; background: #f43f5e; color: white; border-radius: 50px; font-size: 16px; }
```

- [ ] **Step 8.4: Commit**

```bash
git add apps/miniprogram/src/pages/login/ apps/miniprogram/src/app.config.ts
git commit -m "feat: add login page for miniprogram"
```

---

## Task 9: Garden 页面 + RoseCard 组件

**Files:**
- Create: `apps/miniprogram/src/components/RoseCard.tsx`
- Create: `apps/miniprogram/src/components/RoseCard.module.css`
- Create: `apps/miniprogram/src/pages/garden/index.tsx`
- Create: `apps/miniprogram/src/pages/garden/index.module.css`

- [ ] **Step 9.1: 创建 apps/miniprogram/src/components/RoseCard.tsx**

```tsx
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Rose } from '@roselet/core'
import styles from './RoseCard.module.css'

const COLOR_EMOJI: Record<string, string> = { red: '🌹', white: '🤍', yellow: '💛' }
const COLOR_LABEL: Record<string, string> = { red: '红玫瑰', white: '白玫瑰', yellow: '黄玫瑰' }

export function RoseCard({ rose }: { rose: Rose }) {
  return (
    <View className={styles.card} onClick={() => Taro.navigateTo({ url: `/pages/rose/index?id=${rose.id}` })}>
      <View className={styles.header}>
        <Text className={styles.emoji}>{COLOR_EMOJI[rose.color] ?? '🌸'}</Text>
        <Text className={styles.color}>{COLOR_LABEL[rose.color] ?? rose.color}</Text>
        {rose.nickname ? <Text className={styles.nick}>@{rose.nickname}</Text> : null}
      </View>
      {rose.gratitude ? <Text className={styles.field}>🌹 {rose.gratitude}</Text> : null}
      {rose.anxiety ? <Text className={styles.field}>🌵 {rose.anxiety}</Text> : null}
      {rose.hope ? <Text className={styles.field}>🌱 {rose.hope}</Text> : null}
    </View>
  )
}
```

- [ ] **Step 9.2: 创建 apps/miniprogram/src/components/RoseCard.module.css**

```css
.card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
.header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.emoji { font-size: 24px; }
.color { color: #f9a8d4; font-size: 14px; font-weight: 600; }
.nick { color: #64748b; font-size: 12px; margin-left: auto; }
.field { color: #cbd5e1; font-size: 14px; line-height: 1.6; display: block; margin-top: 4px; }
```

- [ ] **Step 9.3: 创建 apps/miniprogram/src/pages/garden/index.tsx**

```tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Rose } from '@roselet/core'
import { getGarden } from '../../api'
import { getToken } from '../../utils/storage'
import { RoseCard } from '../../components/RoseCard'
import styles from './index.module.css'

const FILTERS = [{ value: '', label: '全部' }, { value: 'red', label: '红' }, { value: 'white', label: '白' }, { value: 'yellow', label: '黄' }]

export default function Garden() {
  const [roses, setRoses] = useState<Rose[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [color, setColor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load(p: number, c: string) {
    if (p === 1) setLoading(true)
    getGarden(p, 20, c || undefined)
      .then(res => { setRoses(prev => p === 1 ? res.data : [...prev, ...res.data]); setTotal(res.total); setPage(p) })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1, color) }, [color])
  Taro.useDidShow(() => { load(1, color) })

  return (
    <View className={styles.container}>
      <View className={styles.filters}>
        {FILTERS.map(f => (
          <Text key={f.value} className={`${styles.filter} ${color === f.value ? styles.active : ''}`} onClick={() => setColor(f.value)}>{f.label}</Text>
        ))}
      </View>
      {loading ? <Text className={styles.hint}>加载中...</Text>
        : error ? <Text className={styles.hint}>{error}</Text>
        : roses.length === 0 ? <Text className={styles.hint}>花圃还是空的</Text>
        : (
          <ScrollView scrollY className={styles.list}>
            {roses.map(r => <RoseCard key={r.id} rose={r} />)}
            {roses.length < total && <Text className={styles.more} onClick={() => load(page + 1, color)}>加载更多</Text>}
          </ScrollView>
        )}
      <View className={styles.fab} onClick={() => {
        if (!getToken()) Taro.navigateTo({ url: '/pages/login/index' })
        else Taro.navigateTo({ url: '/pages/plant/index' })
      }}>
        <Text className={styles.fabText}>🌹</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 9.4: 创建 apps/miniprogram/src/pages/garden/index.module.css**

```css
.container { min-height: 100vh; background: #020d1a; padding: 16px; position: relative; }
.filters { display: flex; gap: 8px; margin-bottom: 16px; }
.filter { padding: 6px 14px; border-radius: 50px; font-size: 13px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; }
.active { background: rgba(244,63,94,0.2); border-color: #f43f5e; color: #f43f5e; }
.list { height: calc(100vh - 100px); }
.hint { color: #64748b; font-size: 14px; text-align: center; display: block; margin-top: 80px; }
.more { color: #94a3b8; font-size: 14px; text-align: center; display: block; padding: 16px 0; }
.fab { position: fixed; right: 24px; bottom: 40px; width: 56px; height: 56px; border-radius: 50%; background: #f43f5e; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(244,63,94,0.4); }
.fabText { font-size: 24px; }
```

- [ ] **Step 9.5: Commit**

```bash
git add apps/miniprogram/src/pages/garden/ apps/miniprogram/src/components/
git commit -m "feat: add garden page and RoseCard component for miniprogram"
```

---

## Task 10: Plant 页面（含 WASM 推荐）

**Files:**
- Create: `apps/miniprogram/src/pages/plant/index.tsx`
- Create: `apps/miniprogram/src/pages/plant/index.module.css`

- [ ] **Step 10.1: 创建 apps/miniprogram/src/pages/plant/index.tsx**

```tsx
import { useState, useEffect } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { createRose } from '../../api'
import { getToken } from '../../utils/storage'
import { initWasm, getRecommendation } from '../../utils/wasm'
import styles from './index.module.css'

const COLORS = [{ id: 'red', label: '红玫瑰', emoji: '🌹' }, { id: 'white', label: '白玫瑰', emoji: '🤍' }, { id: 'yellow', label: '黄玫瑰', emoji: '💛' }]

export default function Plant() {
  const [step, setStep] = useState<'color' | 'form' | 'success'>('color')
  const [color, setColor] = useState('')
  const [gratitude, setGratitude] = useState('')
  const [anxiety, setAnxiety] = useState('')
  const [hope, setHope] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [recColor, setRecColor] = useState<string | null>(null)

  useEffect(() => {
    if (!getToken()) { Taro.navigateTo({ url: '/pages/login/index' }); return }
    initWasm().then(ok => {
      if (ok) {
        const rec = getRecommendation([])
        if (rec) setRecColor(rec.color_suggestion.color)
      }
    })
  }, [])

  async function handleSubmit() {
    if (!gratitude.trim() && !anxiety.trim() && !hope.trim()) { setError('至少填写一项'); return }
    setSubmitting(true); setError('')
    try {
      await createRose({ color, gratitude: gratitude.trim() || undefined, anxiety: anxiety.trim() || undefined, hope: hope.trim() || undefined })
      setStep('success')
    } catch { setError('提交失败，请重试') }
    finally { setSubmitting(false) }
  }

  const colorMeta = COLORS.find(c => c.id === color)

  if (step === 'color') return (
    <View className={styles.container}>
      <Text className={styles.title}>选择玫瑰颜色</Text>
      {recColor && <Text className={styles.rec}>推荐：{COLORS.find(c => c.id === recColor)?.label}</Text>}
      <View className={styles.colors}>
        {COLORS.map(c => (
          <View key={c.id} className={styles.colorCard} onClick={() => { setColor(c.id); setStep('form') }}>
            <Text className={styles.colorEmoji}>{c.emoji}</Text>
            <Text className={styles.colorLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )

  if (step === 'success') return (
    <View className={styles.container}>
      <Text className={styles.successEmoji}>{colorMeta?.emoji}</Text>
      <Text className={styles.successTitle}>已种入花圃</Text>
      <Text className={styles.successSub}>AI 正在聆听你的故事...</Text>
      <Button className={styles.btn} onClick={() => Taro.navigateBack()}>回到花圃</Button>
    </View>
  )

  return (
    <View className={styles.container}>
      <Text className={styles.title}>{colorMeta?.emoji} 种下你的玫瑰</Text>
      <Text className={styles.fieldLabel}>🌹 感恩（选填）</Text>
      <Textarea className={styles.textarea} placeholder="这周让你感到幸福的事..." maxlength={500} value={gratitude} onInput={e => setGratitude(e.detail.value)} />
      <Text className={styles.fieldLabel}>🌵 焦虑（选填）</Text>
      <Textarea className={styles.textarea} placeholder="有什么让你感到压力..." maxlength={500} value={anxiety} onInput={e => setAnxiety(e.detail.value)} />
      <Text className={styles.fieldLabel}>🌱 期待（选填）</Text>
      <Textarea className={styles.textarea} placeholder="你现在期待的事情..." maxlength={500} value={hope} onInput={e => setHope(e.detail.value)} />
      {error ? <Text className={styles.error}>{error}</Text> : null}
      <Button className={styles.btn} loading={submitting} disabled={submitting} onClick={handleSubmit}>种下玫瑰</Button>
      <Text className={styles.back} onClick={() => setStep('color')}>换颜色</Text>
    </View>
  )
}
```

- [ ] **Step 10.2: 创建 apps/miniprogram/src/pages/plant/index.module.css**

```css
.container { min-height: 100vh; background: #020d1a; padding: 24px; }
.title { color: #f9a8d4; font-size: 20px; font-weight: bold; text-align: center; display: block; margin-bottom: 8px; }
.rec { color: #86efac; font-size: 13px; text-align: center; display: block; margin-bottom: 24px; }
.colors { display: flex; gap: 16px; justify-content: center; margin-top: 40px; }
.colorCard { display: flex; flex-direction: column; align-items: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; width: 90px; }
.colorEmoji { font-size: 36px; }
.colorLabel { color: #e2e8f0; font-size: 13px; margin-top: 8px; }
.fieldLabel { color: #94a3b8; font-size: 13px; margin-top: 20px; margin-bottom: 6px; display: block; }
.textarea { width: 100%; min-height: 80px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; color: #e2e8f0; font-size: 14px; }
.error { color: #f87171; font-size: 13px; margin-top: 8px; display: block; }
.btn { width: 100%; margin-top: 24px; background: #f43f5e; color: white; border-radius: 50px; font-size: 16px; }
.back { color: #64748b; font-size: 13px; text-align: center; display: block; margin-top: 16px; }
.successEmoji { font-size: 80px; text-align: center; display: block; margin-top: 100px; }
.successTitle { color: #f9a8d4; font-size: 22px; font-weight: bold; text-align: center; display: block; margin-top: 24px; }
.successSub { color: #64748b; font-size: 14px; text-align: center; display: block; margin-top: 8px; margin-bottom: 32px; }
```

- [ ] **Step 10.3: Commit**

```bash
git add apps/miniprogram/src/pages/plant/
git commit -m "feat: add plant page with WASM recommendation for miniprogram"
```

---

## Task 11: Rose 详情页（含 AI 回复）

**Files:**
- Create: `apps/miniprogram/src/pages/rose/index.tsx`
- Create: `apps/miniprogram/src/pages/rose/index.module.css`

- [ ] **Step 11.1: 创建 apps/miniprogram/src/pages/rose/index.tsx**

```tsx
import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Rose } from '@roselet/core'
import { getRose } from '../../api'
import styles from './index.module.css'

const COLOR_EMOJI: Record<string, string> = { red: '🌹', white: '🤍', yellow: '💛' }

export default function RoseDetail() {
  const { id } = Taro.getCurrentInstance().router?.params ?? {}
  const [rose, setRose] = useState<Rose | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getRose(id).then(setRose).catch(() => setError('加载失败'))
  }, [id])

  if (error) return <View className={styles.container}><Text className={styles.hint}>{error}</Text></View>
  if (!rose) return <View className={styles.container}><Text className={styles.hint}>加载中...</Text></View>

  return (
    <View className={styles.container}>
      <Text className={styles.emoji}>{COLOR_EMOJI[rose.color] ?? '🌸'}</Text>
      {rose.nickname && <Text className={styles.nick}>@{rose.nickname}</Text>}
      {rose.gratitude && <View className={styles.section}><Text className={styles.sectionTitle}>🌹 感恩</Text><Text className={styles.content}>{rose.gratitude}</Text></View>}
      {rose.anxiety && <View className={styles.section}><Text className={styles.sectionTitle}>🌵 焦虑</Text><Text className={styles.content}>{rose.anxiety}</Text></View>}
      {rose.hope && <View className={styles.section}><Text className={styles.sectionTitle}>🌱 期待</Text><Text className={styles.content}>{rose.hope}</Text></View>}
      {rose.ai_reply && (
        <View className={styles.aiSection}>
          <Text className={styles.aiTitle}>✨ AI 回应</Text>
          <Text className={styles.aiContent}>{rose.ai_reply}</Text>
        </View>
      )}
    </View>
  )
}
```

- [ ] **Step 11.2: 创建 apps/miniprogram/src/pages/rose/index.module.css**

```css
.container { min-height: 100vh; background: #020d1a; padding: 24px; }
.emoji { font-size: 64px; text-align: center; display: block; margin-bottom: 8px; }
.nick { color: #64748b; font-size: 13px; text-align: center; display: block; margin-bottom: 24px; }
.section { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.sectionTitle { color: #94a3b8; font-size: 13px; font-weight: 600; display: block; margin-bottom: 6px; }
.content { color: #e2e8f0; font-size: 15px; line-height: 1.7; }
.aiSection { background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3); border-radius: 12px; padding: 16px; margin-top: 16px; }
.aiTitle { color: #a78bfa; font-size: 13px; font-weight: 600; display: block; margin-bottom: 8px; }
.aiContent { color: #c4b5fd; font-size: 15px; line-height: 1.7; }
.hint { color: #64748b; font-size: 14px; text-align: center; display: block; margin-top: 100px; }
```

- [ ] **Step 11.3: Commit**

```bash
git add apps/miniprogram/src/pages/rose/
git commit -m "feat: add rose detail page with AI reply for miniprogram"
```

---

## Task 12: 首页重写 + 端对端验证

**Files:**
- Modify: `apps/miniprogram/src/pages/index/index.tsx`（替换 Demo 为真实首页）
- Create: `apps/miniprogram/src/pages/index/index.module.css`

- [ ] **Step 12.1: 替换首页为真实内容**

```tsx
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getToken } from '../../utils/storage'
import { initWasm } from '../../utils/wasm'
import styles from './index.module.css'

export default function Index() {
  Taro.useLoad(() => { initWasm() }) // 后台预热，不阻塞

  function handleEnter() {
    if (!getToken()) Taro.navigateTo({ url: '/pages/login/index' })
    else Taro.navigateTo({ url: '/pages/garden/index' })
  }

  return (
    <View className={styles.container}>
      <Text className={styles.emoji}>🌹</Text>
      <Text className={styles.title}>Roselet</Text>
      <Text className={styles.sub}>种下感恩，花苞，与尖刺</Text>
      <Text className={styles.desc}>感恩一件让你幸福的事 · 说出一件让你焦虑的事 · 期待一件美好的事</Text>
      <Button className={styles.btn} onClick={handleEnter}>进入花圃</Button>
    </View>
  )
}
```

- [ ] **Step 12.2: 创建 apps/miniprogram/src/pages/index/index.module.css**

```css
.container { min-height: 100vh; background: radial-gradient(ellipse at top, #1a0a1e 0%, #020d1a 60%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; }
.emoji { font-size: 72px; margin-bottom: 16px; }
.title { color: #f43f5e; font-size: 32px; font-weight: bold; }
.sub { color: #f9a8d4; font-size: 16px; margin-top: 8px; }
.desc { color: #64748b; font-size: 13px; text-align: center; margin-top: 16px; margin-bottom: 48px; line-height: 1.8; }
.btn { background: #f43f5e; color: white; border-radius: 50px; font-size: 16px; padding: 14px 48px; }
```

- [ ] **Step 12.3: 端对端验证完整流程**

在微信开发者工具中走通：
1. 首页 → "进入花圃" → 登录页（未登录时）
2. 输入昵称 → 注册成功 → 跳花圃
3. 花圃页显示玫瑰列表（需后端 `just dev` 运行中）
4. 点右下角 🌹 → 种花 → 选颜色 → 填写内容 → 提交 → 成功页
5. 花圃点一朵玫瑰 → 详情页显示内容 + AI 回复

- [ ] **Step 12.4: Commit**

```bash
git add apps/miniprogram/src/pages/index/
git commit -m "feat: finalize index page, complete miniprogram MVP"
```

---

## Task 13: 体积审计 + CI 更新

**Files:**
- Modify: `.github/workflows/build.yml`

- [ ] **Step 13.1: 检查主包体积**

```bash
just miniprogram-build
du -sh apps/miniprogram/dist/weapp/
find apps/miniprogram/dist/weapp/ -name "*.wasm" -exec du -h {} \;
```

Expected: 总体积 < 2MB，wasm < 500KB

如果超出：在 `crates/recommend/Cargo.toml` 加 `[profile.release]\nopt-level = "z"` 后重新 `just wasm-mini`

- [ ] **Step 13.2: 在 CI build.yml 新增 miniprogram job**

在 `frontend` job 后添加：

```yaml
  miniprogram:
    name: Miniprogram Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown
      - name: Install wasm-pack
        run: cargo install wasm-pack --locked
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: pnpm-lock.yaml
      - run: pnpm install
      - name: Build WASM for miniprogram
        run: just wasm-mini
      - name: Build miniprogram
        run: just miniprogram-build
```

- [ ] **Step 13.3: Commit + push**

```bash
git add .github/workflows/build.yml
git commit -m "ci: add miniprogram build job"
https_proxy=http://127.0.0.1:7897 git push
```

---

## 自检

**Spec coverage（对照设计文档）：**
- ✅ packages/core 共享类型 → Task 1
- ✅ Web3 接口占位 → Task 1
- ✅ patch-wasm.js → Task 2
- ✅ justfile 任务 → Task 3
- ✅ Taro 初始化 → Task 4
- ✅ polyfill（fast-text-encoding）→ Task 5
- ✅ wx.Storage 封装 → Task 5
- ✅ wx.request 封装 → Task 5
- ✅ WASM 加载器 + Demo 验证 → Task 6
- ✅ API 层 → Task 7
- ✅ login 页面 → Task 8
- ✅ garden 页面 → Task 9
- ✅ plant 页面（含 WASM 推荐降级）→ Task 10
- ✅ rose 详情 + AI 回复 → Task 11
- ✅ 首页 → Task 12
- ✅ 体积审计 → Task 13
- ✅ CI 更新 → Task 13

**Type consistency：**
- `Rose`/`CreateRose`/`PaginatedResponse` 等：Task 1 定义，Task 7/9/10/11 import，一致
- `initWasm()`/`getRecommendation()`：Task 6 定义，Task 10/12 调用，签名一致
- `request<T>()`：Task 5 定义，Task 7 调用，一致
- `Recommendation` 接口：Task 6 在 wasm.ts 内部定义，Task 10 通过 `getRecommendation()` 返回值使用，一致
