# Roselet 生产部署指南

## 当前实际生产部署

当前已执行的生产路线是：

- Web（主入口）：Vercel，`https://roselet-web.vercel.app`
- Web（国内镜像）：Cloudflare Pages，`https://roselet.paxonqiao.com`
- API：AWS Lightsail + Caddy + Rust Axum，`https://roselet.47.131.238.0.sslip.io`
- DB：Lightsail 内 Docker Postgres

`roselet.paxonqiao.com` 作为 Cloudflare Pages 国内镜像，DNS 应 CNAME 到 `roselet.pages.dev`，并保持 Proxy 开启，用于解决部分地区访问 Vercel 困难的问题。完整操作记录、命令和踩坑处理见：

- [docs/AWS_LIGHTSAIL_DEPLOYMENT.md](docs/AWS_LIGHTSAIL_DEPLOYMENT.md)
- `DEVLOG.md` 会话 #71 ~ #73

当前生产环境变量（Vercel / Cloudflare Pages 均需配置）：

```env
NEXT_PUBLIC_API_URL=https://roselet.47.131.238.0.sslip.io
NEXT_PUBLIC_AUTH_API_URL=https://roselet.47.131.238.0.sslip.io
NEXT_PUBLIC_READ_API_URL=https://roselet.47.131.238.0.sslip.io
NEXT_PUBLIC_WS_URL=wss://roselet.47.131.238.0.sslip.io
```

Cloudflare Pages 镜像还要额外注意：

- `apps/web/public/_worker.js` 只用于 `/rose/:id` 的静态导出兜底。
- 必须同时提交 `apps/web/public/_routes.json`，把 Functions 调用限制在 `/rose/*`。
- 否则 Cloudflare Pages 一旦检测到 Function，默认所有请求都会先进入 Functions，首页、静态资源、WASM 也会消耗 daily requests 配额。

## 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- PostgreSQL 14+（如果不使用 Docker）
- Node.js 20+（如果不使用 Docker）
- Rust 1.75+（如果不使用 Docker）

## 快速部署（Docker）

### 1. 克隆仓库

```bash
git clone https://github.com/qiaopengjun5162/roselet.git
cd roselet
```

### 2. 配置环境变量

```bash
# 生成强 JWT 密钥（64 字节）
export JWT_SECRET="$(openssl rand -base64 48)"

# 可选：配置 OpenAI API（AI 回复功能）
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://api.openai.com/v1"
export OPENAI_MODEL="gpt-4"
```

### 3. 启动服务

```bash
docker-compose up -d
```

服务地址：
- 前端：http://localhost:3000
- 后端 API：http://localhost:3001
- Swagger 文档：http://localhost:3001/swagger

### 4. 验证部署

```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 健康检查
curl http://localhost:3001/api/garden
```

## 本地开发部署

### 1. 数据库初始化

```bash
# 创建数据库
createdb roselet

# 运行迁移
just migrate
```

### 2. 构建 WASM 模块

```bash
just wasm
```

### 3. 启动开发服务器

```bash
# 启动后端（3001）+ 前端（3000）
just dev
```

## 生产环境配置

### 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | 是 | `postgres://localhost/roselet` | PostgreSQL 连接字符串 |
| `PORT` | 否 | `3001` | 后端服务端口 |
| `JWT_SECRET` | **是** | `roselet-dev-secret` | JWT 签名密钥（生产环境必须设置，≥32 字节） |
| `OPENAI_API_KEY` | 否 | - | OpenAI API 密钥（AI 回复功能） |
| `OPENAI_BASE_URL` | 否 | `https://api.openai.com/v1` | OpenAI API 地址 |
| `OPENAI_MODEL` | 否 | `gpt-4` | OpenAI 模型名称 |

### 安全建议

1. **JWT_SECRET 强度**
   ```bash
   # 生成 64 字节随机密钥
   openssl rand -base64 48
   ```
   - 最小长度：32 字节
   - 建议长度：64 字节
   - 启动时会检查并警告

2. **数据库连接**
   - 使用 SSL 连接：`DATABASE_URL=postgres://user:pass@host/db?sslmode=require`
   - 限制连接池大小：默认 5 个连接

3. **CORS 配置**
   - 当前允许所有来源（开发模式）
   - 生产环境建议修改 `crates/backend/src/main.rs` 限制来源

4. **速率限制**
   - 当前未实现
   - 建议在反向代理层（Nginx/Caddy）添加

## 性能优化

### 数据库索引

已自动创建以下索引（`migrations/005_add_indexes.sql`）：
- `idx_roses_user_id` - 用户花圃查询
- `idx_roses_color` - 颜色筛选
- `idx_roses_created_at` - 时间排序
- `idx_likes_user_rose` - 点赞查询

### 连接池配置

```rust
// crates/backend/src/main.rs
PgPoolOptions::new()
    .max_connections(20)  // 根据负载调整
    .connect(&config.database_url)
    .await?
```

### 前端优化

- 已启用 Next.js 生产构建优化
- WASM 模块懒加载（112KB）
- 图片资源使用 Next.js Image 组件

## 监控与日志

### 健康检查端点

```bash
# 花圃 API（验证数据库连接）
curl http://localhost:3001/api/garden

# Swagger 文档（验证服务运行）
curl http://localhost:3001/swagger
```

### 日志查看

```bash
# Docker 日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 本地开发日志
# 后端日志输出到 stderr
# 前端日志输出到 stdout
```

### 推荐监控指标

- HTTP 请求延迟（P50/P95/P99）
- 数据库连接池使用率
- WebSocket 连接数
- AI 回复生成成功率
- 错误率（4xx/5xx）

## 备份与恢复

### 数据库备份

```bash
# 备份
pg_dump roselet > backup_$(date +%Y%m%d).sql

# 恢复
psql roselet < backup_20260529.sql
```

### 迁移回滚

```bash
# SQLx 不支持自动回滚，需手动编写 down 迁移
# 或从备份恢复
```

## 故障排查

### 常见问题

1. **JWT_SECRET 警告**
   ```
   WARNING: JWT_SECRET is too short (< 32 bytes), security risk!
   ```
   解决：设置 ≥32 字节的密钥

2. **数据库连接失败**
   ```
   Error: error connecting to database
   ```
   检查：
   - PostgreSQL 是否运行
   - `DATABASE_URL` 是否正确
   - 网络连接是否正常

3. **WASM 模块加载失败**
   ```
   Failed to load WASM module
   ```
   解决：运行 `just wasm` 重新构建

4. **AI 回复不生成**
   - 检查 `OPENAI_API_KEY` 是否设置
   - 查看后端日志确认 API 调用状态
   - 无 API Key 时功能自动跳过（不影响核心功能）

### 调试模式

```bash
# 后端详细日志
RUST_LOG=debug cargo run

# 前端开发模式
cd apps/web && pnpm dev
```

## 扩展部署

### 反向代理（Nginx）

```nginx
upstream backend {
    server localhost:3001;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name roselet.example.com;

    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 多实例部署

```yaml
# docker-compose.prod.yml
services:
  backend:
    deploy:
      replicas: 3
    environment:
      - DATABASE_URL=postgres://prod-host/roselet
      - JWT_SECRET=${JWT_SECRET}
```

## 更新部署

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 应用数据库迁移
just migrate

# 3. 重新构建并重启
docker-compose down
docker-compose up -d --build

# 4. 验证
curl http://localhost:3001/api/garden
```

## 安全检查清单

- [ ] JWT_SECRET 已设置且 ≥32 字节
- [ ] 数据库使用 SSL 连接
- [ ] CORS 限制生产域名
- [ ] 反向代理添加速率限制
- [ ] 定期备份数据库
- [ ] 监控错误日志
- [ ] 依赖审计：`just audit`
- [ ] 更新依赖：`cargo update` + `pnpm update`

## 性能基准

**测试环境**：MacBook Pro M1, 16GB RAM, PostgreSQL 14

| 指标 | 数值 |
|------|------|
| 创建玫瑰 | ~50ms |
| 获取花圃（分页） | ~20ms |
| WebSocket 推送延迟 | <10ms |
| AI 回复生成 | 2-5s（异步，不阻塞） |
| WASM 推荐计算 | <5ms |

## 支持

- GitHub Issues: https://github.com/qiaopengjun5162/roselet/issues
- API 文档: http://localhost:3001/swagger
- 项目文档: [CLAUDE.md](./CLAUDE.md)
