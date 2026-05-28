# Contributing to Roselet

Thank you for your interest in contributing to Roselet!

## Getting Started

### Prerequisites

- Rust (stable)
- Node.js 22+
- pnpm
- PostgreSQL 16+
- cargo-nextest, sqlx-cli

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/qiaopengjun5162/roselet.git
   cd roselet
   ```

2. Initialize the database
   ```bash
   createdb roselet
   just migrate
   ```

3. Start the development environment
   ```bash
   just dev
   ```

## Development Workflow

1. Create a feature branch
   ```bash
   git checkout -b feat/your-feature
   ```

2. Develop and test
   ```bash
   just check-all  # format + lint + test
   ```

3. Commit (Conventional Commits)
   ```bash
   git commit -m "feat: add new feature"
   ```

4. Push and open a Pull Request
   ```bash
   git push origin feat/your-feature
   ```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code refactoring
- `test:` — adding or updating tests
- `chore:` — tooling / config changes

## Code Standards

- Rust: `cargo fmt` + `cargo clippy`
- TypeScript: ESLint + Prettier
- Aim for 100% test coverage
- Write meaningful comments only when the "why" is non-obvious

## Reporting Issues

Please use [GitHub Issues](https://github.com/qiaopengjun5162/roselet/issues) to report bugs or request features.
