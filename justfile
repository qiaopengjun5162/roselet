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
    NO_PROXY=localhost,127.0.0.1 cargo nextest run --all-features -j1
    cd apps/web && pnpm test
    cd apps/miniprogram && pnpm test

# 快速检查
check:
    cargo check --all-features

# clippy lint
clippy:
    cargo clippy --all-features -- -D warnings

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

# 完整检查（格式 + lint + 审计 + 测试）
check-all:
    cargo fmt --all -- --check
    cargo clippy --all-features -- -D warnings
    cargo deny check
    cargo nextest run --all-features -j1

# 提交前检查
pre-commit:
    cargo fmt --all -- --check
    cargo clippy --all-features -- -D warnings
    just test
# 构建 WASM 推荐模块
wasm:
    cd crates/recommend && wasm-pack build --target web --out-dir ../../apps/web/public/pkg

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
