# Roselet - 社区玫瑰花圃破冰应用

# 默认显示帮助
default:
    @just --list

# 编译后端
build:
    cargo build --all-features

# release 编译
build-release:
    cargo build --release --all-features

# 清理构建产物
clean:
    cargo clean
    rm -rf apps/web/.next

# 运行所有测试
test:
    NO_PROXY=localhost,127.0.0.1 cargo nextest run --workspace --all-features -j1
    cd apps/web && pnpm test
    cd apps/miniprogram && pnpm test
    cd apps/agent-api && pnpm test

# 前端覆盖率门禁
coverage:
    pnpm test:coverage

# TypeScript 类型检查
typecheck:
    pnpm typecheck

# Web ESLint 检查
lint:
    pnpm lint

# Web Next 生产构建
next-build:
    cd apps/web && pnpm build

# Cloudflare Worker API 类型检查
worker-typecheck:
    pnpm worker:typecheck

# Cloudflare Worker API 最小行为验证
worker-test:
    pnpm worker:test

# Cloudflare Worker API 本地开发
worker-dev:
    pnpm worker:dev

# Solana x402 Agent API
agent-dev:
    pnpm agent:dev

# Solana x402 付费 MCP Tool
agent-mcp:
    pnpm agent:mcp

# 使用本地 Solana keypair 调用 x402 付费 API
agent-pay:
    pnpm agent:pay

# 构建 Agent API Node WASM
agent-wasm:
    pnpm agent:wasm

# Agent API 类型检查与测试
agent-check:
    pnpm agent:typecheck
    pnpm agent:test

# 快速检查
check:
    cargo check --all-features

# clippy lint
clippy:
    cargo clippy --workspace --all-targets --all-features --tests --benches -- -D warnings

# 格式化检查
format:
    cargo fmt --all -- --check

# 格式化代码
fmt:
    cargo fmt --all

# 启动后端
backend:
    cd crates/backend && DATABASE_URL=postgres://localhost/roselet cargo run

# 启动前端
frontend:
    cd apps/web && pnpm dev

# 启动完整开发环境
dev:
    @echo "Starting backend (3001) and frontend (3000)..."
    @just backend & just frontend

# 仅启动前端开发服务器
dev-web:
    cd apps/web && pnpm dev

# 前端测试
web-test:
    cd apps/web && pnpm test

# 前端构建
web-build:
    just wasm && cd apps/web && pnpm build

# Rust WASM 测试
wasm-test:
    cargo test -p roselet-recommend

# Rust 后端测试
backend-test:
    NO_PROXY=localhost,127.0.0.1 cargo nextest run -p roselet-backend -j1

# 运行数据库迁移
migrate:
    cd crates/backend && sqlx migrate run

# 生成 changelog
changelog:
    git cliff -o CHANGELOG.md

# 依赖审计
audit:
    cargo deny check

# 数据库初始化（创建 + 迁移）
db-init:
    createdb roselet 2>/dev/null || true
    cd crates/backend && sqlx migrate run

# 数据库重置
db-reset:
    dropdb roselet 2>/dev/null || true
    createdb roselet
    cd crates/backend && sqlx migrate run

# 与 CI 四个 job 等价的完整本地门禁（push 前跑；慢，日常仍用 pre-commit）
# 前置：wasm-pack / cargo-deny / cargo-nextest / sqlx-cli 已装；本地 Postgres 已起、
#       DATABASE_URL 已设、跑过 `just db-init`（后端集成测试要用）。
# 为什么要单独一条：`just check-all` / `just pre-commit` 不含 Web 覆盖率门槛和
# 小程序 `taro build --type weapp`，历史上两次造成「本地全绿 / CI 红」
# （clippy doc lint 漏报、@roselet/core 进 webpack 打包图后 TS parser 报错）。
# 用法：push 前跑一次，与 CI 四个 job 等价（约 10 分钟，需本地 Postgres + wasm-pack）。
ci-local:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "===== [1/4] Backend Tests ====="
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets --all-features --tests --benches -- -D warnings
    cargo deny check
    NO_PROXY=localhost,127.0.0.1 cargo nextest run --workspace --all-features -j1
    echo "===== [2/4] Frontend Tests ====="
    (cd crates/recommend && wasm-pack build --target web --out-dir ../../apps/web/public/pkg)
    pnpm --filter web typecheck
    pnpm --filter web lint
    pnpm build
    pnpm --filter web test:coverage
    echo "===== [3/4] Miniprogram Build ====="
    bash scripts/init-miniprogram.sh
    (cd crates/recommend && wasm-pack build --target web --out-dir ../../apps/miniprogram/pkg)
    node scripts/patch-wasm.js
    pnpm --filter @roselet/miniprogram typecheck
    (cd apps/miniprogram && pnpm build:weapp)
    pnpm --filter @roselet/miniprogram test:coverage
    echo "===== [4/4] Solana x402 Agent API ====="
    (cd crates/recommend && wasm-pack build --target nodejs --out-dir ../../apps/agent-api/pkg)
    pnpm agent:typecheck
    pnpm agent:test
    pnpm agent:build
    echo "===== ci-local OK：四关与 CI 一致 ====="

# 完整检查（格式 + lint + 审计 + 测试）
check-all:
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets --all-features --tests --benches -- -D warnings
    cargo deny check
    pnpm typecheck
    pnpm lint
    cd apps/web && pnpm build
    pnpm agent:build
    pnpm agent:test
    cargo nextest run --workspace --all-features -j1

# 提交前检查
pre-commit:
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets --all-features --tests --benches -- -D warnings
    cargo deny check
    pnpm typecheck
    pnpm lint
    cd apps/web && pnpm build
    pnpm agent:build
    just test
# 构建 WASM 推荐模块
wasm:
    cd crates/recommend && wasm-pack build --target web --out-dir ../../apps/web/public/pkg
    rm -f apps/web/public/pkg/.gitignore

# 完整构建（后端 + WASM + 前端）
build-all: wasm build
    cd apps/web && pnpm build

# 小程序初始化（从模板生成 project.config.json，需设置 TARO_APP_ID 环境变量）
miniprogram-init:
    bash scripts/init-miniprogram.sh


# 为小程序构建 WASM（编译 + WXWebAssembly 补丁）
wasm-mini: miniprogram-init
    cd crates/recommend && wasm-pack build --target web --out-dir ../../apps/miniprogram/pkg
    node scripts/patch-wasm.js

# 小程序开发模式（微信）
miniprogram: miniprogram-init
    cd apps/miniprogram && pnpm dev:weapp

# 小程序生产构建
miniprogram-build: miniprogram-init
    cd apps/miniprogram && pnpm build:weapp
