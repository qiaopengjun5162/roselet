# ==============================================================================
# Project: Roselet
# Description: 社区玫瑰花圃破冰应用
# ==============================================================================

# ------------------------------------------------------------------------------
# Variables
# ------------------------------------------------------------------------------
CARGO := cargo
SHELL := /bin/bash
MAIN_BRANCH := main

# ------------------------------------------------------------------------------
# Main Targets
# ------------------------------------------------------------------------------
.PHONY: all build clean test check clippy format help dev

all: build

## build: 编译后端
build:
	@$(CARGO) build --all-features

## build-release: release 模式编译
build-release:
	@$(CARGO) build --release --all-features

## clean: 清理构建产物
clean:
	@$(CARGO) clean
	@rm -rf apps/web/.next apps/web/node_modules

## test: 运行所有测试
test:
	@$(CARGO) nextest run --all-features -- --test-threads=1
	@cd apps/web && pnpm test

## check: 快速检查代码
check:
	@$(CARGO) check --all-features

## clippy: 代码 lint
clippy:
	@$(CARGO) clippy --all-features -- -D warnings

## format: 格式化代码
format:
	@$(CARGO) fmt --all -- --check

## dev: 启动开发环境（后端 + 前端）
dev:
	@echo "Starting backend on port 3001..."
	@cd crates/backend && DATABASE_URL=postgres://localhost/roselet $(CARGO) run &
	@echo "Starting frontend on port 3000..."
	@cd apps/web && pnpm dev

## help: 显示帮助信息
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
