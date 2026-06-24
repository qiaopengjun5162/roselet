# 免费部署执行清单

> **历史方案说明**
>
> 当前 Roselet 生产环境已切换为 `Vercel Web + AWS Lightsail Rust backend + Docker Postgres + Caddy HTTPS`，详见 [AWS_LIGHTSAIL_DEPLOYMENT.md](AWS_LIGHTSAIL_DEPLOYMENT.md)。
> 本文档记录的免费部署执行清单仅作为历史参考，不再维护。

> 目标：不买服务器，先把 Roselet 第一版发出去  
> 路线：`Vercel Hobby + Render Free + Neon Free + GitHub Pages`

## 当前推荐顺序

1. 先部署数据库 `Neon`
2. 再部署后端 `Render`
3. 再部署前端 `Vercel`
4. 最后决定要不要加 `GitHub Pages` 介绍页

配变量时可直接参考：

- [docs/DEPLOYMENT_ENV_TEMPLATE.md](docs/DEPLOYMENT_ENV_TEMPLATE.md)

---

## 0. 上线前先确认

当前第一版免费上线，不追求最强，只追求先跑通：

- [ ] 首页能打开
- [ ] 用户能注册/登录
- [ ] 用户能种花
- [ ] 花圃能展示
- [ ] AI 回复可选启用
- [ ] WebSocket 能用则保留，若免费环境不稳，第一版可接受弱化

---

## 1. 部署数据库：Neon Free

### 要做什么

- [ ] 注册 Neon
- [ ] 创建一个新项目
- [ ] 创建生产数据库
- [ ] 拿到 `DATABASE_URL`

### 需要保存的值

- [ ] `DATABASE_URL`

### 备注

- 当前后端直接吃标准 Postgres 连接串
- Neon 这里本质上替代的是“自己买服务器装 PostgreSQL”

---

## 2. 部署后端：Render Free

### 目标

把 `crates/backend` 跑成一个可公网访问的 Rust API 服务。

### 推荐方式

优先尝试用现有 `Dockerfile.backend` 部署。

原因：

- 当前仓库已经有 Docker 化路径
- 比直接在 Render 上手搓 Rust 构建命令更稳
- 更接近本地已有部署模型
- 仓库已补 `render.yaml`，可作为 Render Blueprint/配置参考

### Render 上需要配置

- [ ] 新建 `Web Service`
- [ ] 连接 GitHub 仓库
- [ ] 选择 Docker 部署

### 后端环境变量

Render 需要设置这些：

- [ ] `DATABASE_URL=<Neon 提供的连接串>`
- [ ] `PORT=3001`
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET=<至少 32 字节的随机值>`
- [ ] `ALLOWED_ORIGINS=<前端域名，后面填 Vercel 线上域名>`

可选：

- [ ] `OPENAI_API_KEY`
- [ ] `OPENAI_BASE_URL`
- [ ] `OPENAI_MODEL`
- [ ] `RUST_LOG=roselet=info`

### 后端上线后要验证

- [ ] `GET /health` 正常
- [ ] `GET /api/garden` 正常
- [ ] `GET /swagger` 正常

### 你最终会得到

- [ ] 后端公网地址，例如：`https://roselet-backend.onrender.com`

### 风险提示

- Render Free 会休眠
- 首次唤醒会慢
- WebSocket 长连接稳定性一般

第一版可以接受这个代价。

---

## 3. 部署前端：Vercel Hobby

### 目标

把 `apps/web` 部署成真正可访问的主站。

### Vercel 上需要配置

- [ ] 导入 GitHub 仓库
- [ ] Root Directory 选择 `apps/web`
- [ ] 仓库根目录已补 `vercel.json`，可作为默认构建配置参考

### Build 配置

建议先按默认识别，必要时手动确认：

- Install Command:
  - `pnpm install`
- Build Command:
  - `pnpm build`
- Output:
  - 由 Next.js 自动处理

### 前端环境变量

- [ ] `NEXT_PUBLIC_API_URL=<Render 后端地址>`
- [ ] `NEXT_PUBLIC_WS_URL=<Render 后端 ws 地址>`

示例：

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-backend.onrender.com
```

### Web 构建前注意

当前前端依赖 WASM 产物：

- `apps/web/public/pkg`

本地命令里已经说明 Web 构建前要先跑：

```bash
just wasm
```

所以需要确认 Vercel 构建时：

- 要么仓库里已经有可用 WASM 产物
- 要么构建命令前先生成一次 WASM

当前状态：

- 本地已验证 `cd apps/web && pnpm build` 可以通过
- 当前仓库依赖 `apps/web/scripts/ensure-wasm.mjs` 在缺少真实产物时生成 stub，保证 `next build` 不会因为缺文件直接失败
- 但如果线上要启用真实 WASM 推荐/粒子能力，平台构建前仍应补一次 `just wasm`

也就是说：

- 第一版上线：当前配置已足够先部署
- 要求线上完整启用真实 WASM 产物：后续再把 Vercel 构建命令升级为包含 `just wasm`

### 前端上线后要验证

- [ ] 首页能打开
- [ ] 登录页能打开
- [ ] 花圃页能加载
- [ ] 提交种花请求能成功

---

## 4. CORS 最后回填

等 Vercel 给你正式域名后，要回到 Render 把：

- [ ] `ALLOWED_ORIGINS`

改成类似：

```env
ALLOWED_ORIGINS=https://your-app.vercel.app
```

如果有自定义域名，也一并加进去：

```env
ALLOWED_ORIGINS=https://your-app.vercel.app,https://roselet.yourdomain.com
```

---

## 5. 冒烟检查

全部部署完后，按这个顺序检查：

### 基础检查

- [ ] 前端首页打开正常
- [ ] 后端 `/health` 返回正常
- [ ] Swagger 页面可访问

### 核心功能检查

- [ ] 注册成功
- [ ] 登录成功
- [ ] 种花成功
- [ ] 花圃列表可见
- [ ] 详情页可见
- [ ] 点赞成功

### AI 检查

如果填了 OpenAI 兼容变量：

- [ ] 种花后 AI 回复能生成

如果没填：

- [ ] 核心流程仍然正常，不因 AI 缺失阻塞

---

## 6. 如果 WebSocket 不稳怎么办

第一版不要把 WebSocket 当成上线阻塞项。

优先级应该是：

1. 注册/登录
2. 种花
3. 花圃读取
4. 详情页
5. 点赞
6. WebSocket 实时更新

也就是说：

- 如果免费环境下 `/api/ws` 有波动
- 先接受“刷新后可见新内容”
- 不要为了实时推送卡住整版上线

---

## 7. GitHub Pages 要不要现在做

当前判断：

- 不是必须
- 可作为加分项

适合放：

- 项目介绍
- 截图
- 功能说明
- 演示入口链接

如果当前时间有限：

- [ ] 先不上 GitHub Pages
- [ ] 先把主应用跑起来

---

## 8. 当前最重要的阻塞点

现在真正需要尽快验证的，不是平台选型，而是这两个技术点：

1. `Vercel` 构建时 WASM 产物怎么生成
2. `Render Free` 下 WebSocket 是否还能满足第一版可用

这两个点跑通，第一版免费上线就基本成立。

---

## 9. 现在就该做什么

如果下一步开始实际部署，就按这个顺序：

1. 去 Neon 建库
2. 去 Render 部后端
3. 去 Vercel 部前端
4. 回填 CORS
5. 跑冒烟检查

这就是当前最小可行免费上线路径。
