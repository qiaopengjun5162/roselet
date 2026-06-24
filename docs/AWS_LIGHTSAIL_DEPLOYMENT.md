# AWS Lightsail 部署记录与操作手册

> 更新时间：2026-06-24  
> 当前用途：记录 Roselet 已执行的 AWS Lightsail 部署操作，并作为后续维护手册。

## 当前生产拓扑

```text
用户浏览器
  -> Vercel Web: https://roselet-web.vercel.app
  -> AWS Lightsail: http://47.131.238.0
      -> Caddy :80
      -> Rust Axum backend :3001
      -> Docker Postgres :5432
GitHub Actions
  -> GHCR: ghcr.io/qiaopengjun5162/roselet-backend:<sha>
  -> SSH deploy to Lightsail
```

当前生产后端基址：

```text
http://47.131.238.0
```

已验证接口：

```bash
curl http://47.131.238.0/health
curl 'http://47.131.238.0/api/garden?page=1&per_page=3'
```

## AWS 资源

| 项 | 当前值 |
|----|--------|
| Region | `ap-southeast-1` |
| Instance | `roselet-prod` |
| Blueprint | `ubuntu_24_04` |
| Bundle | `micro_3_0` |
| Static IP | `47.131.238.0` |
| OS | Ubuntu 24.04 |
| SSH user | `ubuntu` |

SSH：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0
```

注意：

- 本机 AWS CLI 已安装但没有 AWS 凭据。
- 实例创建和初始端口开放是在 AWS CloudShell 里完成的。
- 后续部署维护主要走 SSH，不依赖本机 AWS CLI。

## 自动化部署主线

当前推荐部署方式已经从“在 Lightsail 上编译 Rust”升级为：

```text
push main
  -> CI 通过
  -> Deploy Backend workflow 构建 Docker 镜像
  -> 推送到 GHCR
  -> SSH 到 Lightsail
  -> 服务器拉镜像并重启 backend
  -> /health 公网冒烟
```

相关文件：

- `.github/workflows/deploy-backend.yml`
- `deploy/lightsail/docker-compose.backend.yml`
- `scripts/lightsail-deploy.sh`
- `Dockerfile.backend`

### GitHub Actions Secrets

已配置的 repository secrets：

| Secret | 用途 |
|--------|------|
| `LIGHTSAIL_HOST` | Lightsail 静态 IP，当前为 `47.131.238.0` |
| `LIGHTSAIL_USER` | SSH 用户，当前为 `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | GitHub Actions 用于 SSH 登录 Lightsail 的私钥 |
| `LIGHTSAIL_KNOWN_HOSTS` | Lightsail SSH host key，避免关闭 host key 校验 |

GHCR 登录使用每次 workflow 的临时 `GITHUB_TOKEN`，部署完成后执行 `docker logout ghcr.io`。不要为 GHCR 额外保留长期 PAT，除非后续确认包权限必须这样做。

### 手动触发部署

```bash
gh workflow run deploy-backend.yml --repo qiaopengjun5162/roselet
```

查看运行：

```bash
gh run list --workflow deploy-backend.yml --repo qiaopengjun5162/roselet
```

### 服务器运行编排

自动部署使用：

```bash
deploy/lightsail/docker-compose.backend.yml
```

它不再在服务器上 `build:`，而是使用：

```yaml
image: ${BACKEND_IMAGE}
```

这能避免 `micro_3_0` 服务器反复承担 Rust release 编译。

### 回滚

服务器会在部署前记录旧镜像：

```text
~/roselet/.previous_backend_image
```

如果新镜像有问题，可 SSH 到服务器后手动回滚：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 'set -euo pipefail
cd ~/roselet
BACKEND_IMAGE=$(cat .previous_backend_image)
bash scripts/lightsail-deploy.sh
'
```

## 已执行的 AWS CloudShell 操作

查询 Ubuntu blueprint：

```bash
export AWS_REGION=ap-southeast-1

aws lightsail get-blueprints \
  --region "$AWS_REGION" \
  --query "blueprints[?contains(name, 'Ubuntu')].[blueprintId,name]" \
  --output table
```

查询 Lightsail 套餐：

```bash
aws lightsail get-bundles \
  --region "$AWS_REGION" \
  --query 'bundles[?isActive==`true`].[bundleId,name,price,cpuCount,ramSizeInGb,diskSizeInGb]' \
  --output table
```

创建实例：

```bash
export AWS_REGION=ap-southeast-1
export INSTANCE_NAME=roselet-prod
export KEY_NAME=roselet-prod-key
export BLUEPRINT_ID=ubuntu_24_04
export BUNDLE_ID=micro_3_0

aws lightsail create-key-pair \
  --region "$AWS_REGION" \
  --key-pair-name "$KEY_NAME" \
  --query 'privateKeyBase64' \
  --output text > "${KEY_NAME}.pem"

chmod 400 "${KEY_NAME}.pem"

aws lightsail create-instances \
  --region "$AWS_REGION" \
  --instance-names "$INSTANCE_NAME" \
  --availability-zone "${AWS_REGION}a" \
  --blueprint-id "$BLUEPRINT_ID" \
  --bundle-id "$BUNDLE_ID" \
  --key-pair-name "$KEY_NAME"
```

开放端口并绑定静态 IP：

```bash
export AWS_PAGER=""
export AWS_REGION=ap-southeast-1
export INSTANCE_NAME=roselet-prod

aws lightsail open-instance-public-ports \
  --region "$AWS_REGION" \
  --instance-name "$INSTANCE_NAME" \
  --port-info fromPort=22,toPort=22,protocol=TCP

aws lightsail open-instance-public-ports \
  --region "$AWS_REGION" \
  --instance-name "$INSTANCE_NAME" \
  --port-info fromPort=80,toPort=80,protocol=TCP

aws lightsail open-instance-public-ports \
  --region "$AWS_REGION" \
  --instance-name "$INSTANCE_NAME" \
  --port-info fromPort=443,toPort=443,protocol=TCP

aws lightsail allocate-static-ip \
  --region "$AWS_REGION" \
  --static-ip-name roselet-prod-ip

aws lightsail attach-static-ip \
  --region "$AWS_REGION" \
  --static-ip-name roselet-prod-ip \
  --instance-name "$INSTANCE_NAME"

aws lightsail get-static-ip \
  --region "$AWS_REGION" \
  --static-ip-name roselet-prod-ip \
  --query 'staticIp.ipAddress' \
  --output text
```

将本机部署公钥加入服务器：

```bash
export IP=47.131.238.0
export KEY_NAME=roselet-prod-key
export CODEX_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGo0qriyeR5Wex6pcGGpRFkrOZ8jNm2Z25MO4N+oYBgq roselet-deploy-codex'

ssh -o StrictHostKeyChecking=accept-new -i "${KEY_NAME}.pem" ubuntu@"$IP" \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && grep -qxF \"$CODEX_PUBKEY\" ~/.ssh/authorized_keys 2>/dev/null || echo \"$CODEX_PUBKEY\" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

## 已执行的服务器初始化

安装基础工具、Docker、swap、UFW：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 <<'EOF'
set -euo pipefail
sudo apt-get update
sudo apt-get install -y ca-certificates curl git ufw
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker ubuntu
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3001/tcp
sudo ufw --force enable
sudo docker --version
free -h
EOF
```

验证：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 \
  'docker --version; docker compose version; free -h; sudo ufw status'
```

## 已执行的应用部署

拉取仓库：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 'set -euo pipefail
if [ ! -d ~/roselet/.git ]; then
  git clone https://github.com/qiaopengjun5162/roselet.git ~/roselet
else
  cd ~/roselet
  git fetch origin main
  git checkout main
  git pull --ff-only origin main
fi
cd ~/roselet
git rev-parse --short HEAD
git status --short --branch
'
```

以下是最初手动部署记录。当前自动部署已改用 `deploy/lightsail/docker-compose.backend.yml`，这段保留用于追溯。

在服务器创建 `.env.production` 和 `docker-compose.prod.yml`：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 'bash -s' <<'REMOTE'
set -euo pipefail
cd ~/roselet
if [ ! -f .env.production ]; then
  umask 077
  cat > .env.production <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
NODE_ENV=production
PORT=3001
RUST_LOG=roselet=info
ALLOWED_ORIGINS=https://roselet-web.vercel.app,http://47.131.238.0
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
ENV
fi
cat > docker-compose.prod.yml <<'YAML'
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: roselet
      POSTGRES_USER: roselet
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U roselet -d roselet"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://roselet:${POSTGRES_PASSWORD}@db:5432/roselet
      PORT: ${PORT:-3001}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: ${NODE_ENV:-production}
      RUST_LOG: ${RUST_LOG:-roselet=info}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OPENAI_BASE_URL: ${OPENAI_BASE_URL:-https://api.openai.com/v1}
      OPENAI_MODEL: ${OPENAI_MODEL:-gpt-4o-mini}
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
YAML
chmod 600 .env.production
ls -l .env.production docker-compose.prod.yml
REMOTE
```

启动：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 \
  'cd ~/roselet && sudo docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build'
```

查看状态：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 \
  'cd ~/roselet && sudo docker compose --env-file .env.production -f docker-compose.prod.yml ps'
```

## 当前服务器环境变量要求

服务器 `.env.production` 必须包含：

```env
POSTGRES_PASSWORD=<服务器随机生成，不能入库>
JWT_SECRET=<服务器随机生成，不能入库>
NODE_ENV=production
PORT=3001
RUST_LOG=roselet=info
ALLOWED_ORIGINS=https://roselet-web.vercel.app,http://47.131.238.0
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
BACKEND_IMAGE=roselet-backend:latest
```

`BACKEND_IMAGE` 是本地兜底默认值；GitHub Actions 部署时会通过环境变量覆盖为 `ghcr.io/...:<sha>`。

## 已执行的 Caddy 反向代理

因为公网直连 `3001` 超时，生产入口改为 `80 -> 3001`。

安装并配置 Caddy：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 'set -euo pipefail
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo apt-get update
sudo apt-get install -y caddy
cat <<EOF | sudo tee /etc/caddy/Caddyfile >/dev/null
:80 {
    reverse_proxy 127.0.0.1:3001
}
EOF
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager -l | sed -n "1,80p"
'
```

验证：

```bash
curl -i --max-time 15 http://47.131.238.0/health
curl -i --max-time 15 'http://47.131.238.0/api/garden?page=1&per_page=3'
```

## 已执行的写路径冒烟

注册、种花、读取详情：

```bash
set -euo pipefail
NICK="codex-deploy-$(date +%s)"
REGISTER=$(curl -sS --max-time 15 -X POST http://47.131.238.0/api/auth/register \
  -H 'content-type: application/json' \
  -d "{\"nickname\":\"$NICK\",\"passphrase\":\"deploy-passphrase\"}")
echo "$REGISTER" | jq '{user: .user, has_access: (.access_token | type == "string"), has_refresh: (.refresh_token | type == "string")}'
TOKEN=$(echo "$REGISTER" | jq -r '.access_token')
ROSE=$(curl -sS --max-time 15 -X POST http://47.131.238.0/api/rose \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"color":"red","gratitude":"部署冒烟测试","anxiety":"担心公网链路","hope":"希望用户可以访问"}')
echo "$ROSE" | jq '{id, color, gratitude, anxiety, hope, user_id}'
RID=$(echo "$ROSE" | jq -r '.id')
curl -sS --max-time 15 "http://47.131.238.0/api/rose/$RID" | jq '{id, color, gratitude, user_id}'
```

## Vercel 待完成配置

Vercel Web 仍需设置生产环境变量并重新部署：

```env
NEXT_PUBLIC_API_URL=http://47.131.238.0
NEXT_PUBLIC_AUTH_API_URL=http://47.131.238.0
NEXT_PUBLIC_READ_API_URL=http://47.131.238.0
NEXT_PUBLIC_WS_URL=ws://47.131.238.0
```

已尝试使用 Vercel CLI，但当前本机网络/TLS 失败：

```text
request to https://vercel.com/.well-known/openid-configuration failed
Client network socket disconnected before secure TLS connection was established
```

后续可在 CLI 网络恢复后执行，或在 Vercel 控制台手动设置。

## 常用维护命令

查看服务：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 \
  'cd ~/roselet && sudo docker compose --env-file .env.production -f docker-compose.prod.yml ps'
```

查看日志：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 \
  'cd ~/roselet && sudo docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=120 backend'
```

更新后端：

```bash
gh workflow run deploy-backend.yml --repo qiaopengjun5162/roselet
```

手动 SSH 部署指定镜像：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 \
  'cd ~/roselet && BACKEND_IMAGE=ghcr.io/qiaopengjun5162/roselet-backend:<sha> bash scripts/lightsail-deploy.sh'
```

查看资源：

```bash
ssh -i ~/.ssh/roselet_lightsail ubuntu@47.131.238.0 \
  'free -h && df -h / && sudo docker system df'
```

## 已踩坑与处理方式

### 本机 AWS CLI 无凭据

现象：本机 AWS CLI 已安装，但没有 AWS Access Key，不能直接管理 Lightsail。

处理：实例创建走 AWS CloudShell，后续维护走 SSH。

### Docker 构建缺少 SQLx 离线缓存

现象：后端使用 `sqlx::query_scalar!`，Docker 构建环境没有数据库连接时可能编译失败。

处理：

- `Dockerfile.backend` 复制 `.sqlx/`。
- Docker 构建使用 `SQLX_OFFLINE=true cargo build --release -p roselet-backend`。

### 服务器缺少 `Cargo.lock`

现象：服务器构建时报：

```text
COPY Cargo.toml Cargo.lock ./
"/Cargo.lock": not found
```

处理：

- 从 `.gitignore` 移除 `Cargo.lock`。
- 将根目录 `Cargo.lock` 纳入版本控制。

### 公网直连 3001 超时

现象：

- 容器内后端正常监听 `0.0.0.0:3001`。
- 服务器本机 `curl http://127.0.0.1:3001/health` 正常。
- 外网 `curl http://47.131.238.0:3001/health` 超时。

处理：

- 不依赖裸露应用端口。
- 使用 Caddy 监听 80，反代到 `127.0.0.1:3001`。

### 小机器首次 Rust release 构建较慢

现象：`micro_3_0` 首次 `cargo build --release` 编译依赖耗时数分钟。

处理：

- 加 2G swap。
- 首次构建耐心等待。
- 如果未来 OOM 或构建太慢，可改为 CI 构建镜像并推送 registry，服务器只拉镜像。

## 安全注意

- `.env.production` 只保存在服务器，权限为 `600`，不能提交到 Git。
- 文档只记录命令模板和公开 IP，不记录数据库密码、JWT_SECRET、私钥。
- 目前公网是 HTTP。正式对外前建议绑定域名，然后让 Caddy 自动签发 HTTPS。
- 如果继续使用 IP + HTTP，浏览器安全策略会影响部分能力；生产前应尽快上域名和 HTTPS。
