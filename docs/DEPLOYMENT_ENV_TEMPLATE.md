# 部署环境变量模板

> 用途：实际部署时直接照着填  
> 当前免费方案：`Neon + Render + Vercel`

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

## 4. 推荐填写顺序

1. 先拿到 Neon 的 `DATABASE_URL`
2. 先部署 Render，拿到后端公网域名
3. 再填 Vercel 的 `NEXT_PUBLIC_API_URL` 和 `NEXT_PUBLIC_WS_URL`
4. 最后把 Vercel 域名回填到 Render 的 `ALLOWED_ORIGINS`

---

## 5. 当前最小可行填写示例

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
NEXT_PUBLIC_WS_URL=wss://roselet-backend.onrender.com
```
