# 贡献指南

感谢你对 Roselet 项目的关注！

## 开发环境

1. 安装依赖
   - Rust (stable)
   - Node.js 20+
   - pnpm
   - PostgreSQL 16+
   - cargo-nextest, sqlx-cli

2. 克隆项目
   ```bash
   git clone https://github.com/qiaopengjun5162/roselet.git
   cd roselet
   ```

3. 初始化数据库
   ```bash
   createdb roselet
   just migrate
   ```

4. 启动开发环境
   ```bash
   just dev
   ```

## 开发流程

1. 创建分支
   ```bash
   git checkout -b feat/your-feature
   ```

2. 开发 + 测试
   ```bash
   just check-all  # 格式化 + lint + 测试
   ```

3. 提交（Conventional Commits）
   ```bash
   git commit -m "feat: add new feature"
   ```

4. 推送 + PR
   ```bash
   git push origin feat/your-feature
   ```

## Commit 规范

使用 Conventional Commits：
- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `refactor:` 重构
- `test:` 测试
- `chore:` 工具/配置

## 代码规范

- Rust: `cargo fmt` + `cargo clippy`
- TypeScript: ESLint + Prettier
- 测试覆盖率尽可能 100%
- 代码附必要注释

## 问题反馈

请使用 GitHub Issues 反馈问题。
