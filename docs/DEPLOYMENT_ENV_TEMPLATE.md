# 部署环境变量模板

> 用途：实际部署时直接照着填  
> 当前实际路线：`Vercel + AWS Lightsail Rust 后端 + Docker Postgres`

## 0. 当前 Lightsail 生产后端

当前后端基址：

```env
ROSELET_API_BASE=https://roselet.47.131.238.0.sslip.io
```

`http://47.131.238.0` 只用于服务器/IP 冒烟验证。Vercel Web 是 HTTPS 页面，生产环境变量必须使用 HTTPS API 基址，否则浏览器会按 mixed content 拦截请求。

服务器上的 `.env.production` 只保存在 Lightsail，不能提交到 Git。关键变量：

```env
POSTGRES_PASSWORD=<服务器随机生成，不能入库>
JWT_SECRET=<服务器随机生成，不能入库>
NODE_ENV=production
PORT=3001
RUST_LOG=roselet=info
ALLOWED_ORIGINS=https://roselet-web.vercel.app,http://47.131.238.0
ADMIN_USER_IDS=<允许访问 /api/stats 的用户 id，多个用英文逗号分隔>
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
BACKEND_IMAGE=roselet-backend:latest
```

GitHub Actions 自动部署时会把 `BACKEND_IMAGE` 覆盖成 `ghcr.io/qiaopengjun5162/roselet-backend:<sha>`。

GitHub repository secrets：

```env
LIGHTSAIL_HOST=47.131.238.0
LIGHTSAIL_USER=ubuntu
LIGHTSAIL_SSH_KEY=<Lightsail deploy private key>
LIGHTSAIL_KNOWN_HOSTS=<ssh-keyscan output>
```

Vercel 前端下一步需要设置：

```env
NEXT_PUBLIC_API_URL=https://roselet.47.131.238.0.sslip.io
NEXT_PUBLIC_AUTH_API_URL=https://roselet.47.131.238.0.sslip.io
NEXT_PUBLIC_READ_API_URL=https://roselet.47.131.238.0.sslip.io
NEXT_PUBLIC_WS_URL=wss://roselet.47.131.238.0.sslip.io
```

完整操作手册见：

- [AWS Lightsail 部署记录与操作手册](AWS_LIGHTSAIL_DEPLOYMENT.md)

---

## 历史免费方案：Neon + Cloudflare Workers + Vercel

下面内容保留作为历史路线和后续无服务器迁移参考，不是当前生产主线。

## 1. Neon

Neon 主要提供：

- `DATABASE_URL`

部署时你最终会拿到类似：

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
```

---

## 2. Render 后端环境变量

后端必须设置：

```env
DATABASE_URL=<Neon 提供的 DATABASE_URL>
PORT=3001
NODE_ENV=production
JWT_SECRET=<至少 32 字节随机字符串>
ALLOWED_ORIGINS=<Vercel 前端域名>
```

后端可选设置：

```env
OPENAI_API_KEY=<可选>
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
RUST_LOG=roselet=info
```

### JWT_SECRET 生成建议

本地可用：

```bash
openssl rand -base64 48
```

---

## 3. Vercel 前端环境变量

前端必须设置：

```env
NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com
NEXT_PUBLIC_WS_URL=wss://<your-render-service>.onrender.com
```

---

## 4. Cloudflare Worker 环境变量

Worker 必须设置：

```env
APP_NAME=roselet-worker-api
DATABASE_URL=<Neon 提供的 DATABASE_URL>
JWT_SECRET=<必须和 Rust 后端一致>
ADMIN_USER_IDS=<允许访问 /stats 的用户 id，多个用英文逗号分隔>
ALLOWED_ORIGINS=https://roselet-web.vercel.app
```

`ADMIN_USER_IDS` 用于限制应用后台统计页。`/api/stats` 默认不是公开接口；未来如需公开数据，应新增脱敏的公开统计接口。

---

## 5. 推荐填写顺序

1. 先拿到 Neon 的 `DATABASE_URL`
2. 先部署 Cloudflare Worker，设置 `DATABASE_URL` / `JWT_SECRET` / `ADMIN_USER_IDS`
3. 在 Vercel 设置 `NEXT_PUBLIC_WORKER_API_URL` 和 `NEXT_PUBLIC_READ_API_URL`
4. 尚未迁移到 Worker 的写接口继续用 `NEXT_PUBLIC_API_URL` 指向旧 Rust 后端或本地调试后端
5. 最后把 Vercel 域名回填到 Worker / Rust 后端的 `ALLOWED_ORIGINS`

---

## 6. 当前最小可行填写示例

### Render

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
PORT=3001
NODE_ENV=production
JWT_SECRET=replace-with-a-long-random-secret
ALLOWED_ORIGINS=https://roselet-web.vercel.app
OPENAI_MODEL=gpt-4o-mini
RUST_LOG=roselet=info
```

### Vercel

```env
NEXT_PUBLIC_API_URL=https://roselet-backend.onrender.com
NEXT_PUBLIC_WORKER_API_URL=https://roselet-worker-api.<your-subdomain>.workers.dev
NEXT_PUBLIC_READ_API_URL=https://roselet-worker-api.<your-subdomain>.workers.dev
NEXT_PUBLIC_WS_URL=wss://roselet-backend.onrender.com
```
