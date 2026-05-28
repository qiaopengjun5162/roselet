# Roselet

A community icebreaker web app: plant roses (gratitude), buds (hope), and thorns (anxiety) to grow a shared garden.

[中文文档](README_zh.md)

## Tech Stack

- **Backend**: Rust + Axum + SQLx + PostgreSQL
- **Frontend**: Next.js 15 + shadcn UI + Tailwind CSS
- **Real-time**: WebSocket (tokio broadcast)
- **Auth**: JWT (jsonwebtoken)

## Quick Start

### Prerequisites

- Rust (stable)
- Node.js 22+
- pnpm
- PostgreSQL 16+

### Installation

```bash
git clone https://github.com/qiaopengjun5162/roselet.git
cd roselet
just db-init    # create database + run migrations
just dev        # start backend (3001) + frontend (3000)
```

### Common Commands

```bash
just dev           # start dev environment
just test          # run all tests
just check-all     # format + lint + audit + test
just pre-commit    # pre-commit checks
just db-reset      # reset database
```

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user (nickname → JWT) |
| POST | `/api/rose` | Plant a rose |
| GET | `/api/garden?page=&per_page=` | Get garden (paginated) |
| GET | `/api/rose/:id` | Get a single rose |
| GET | `/api/ws` | WebSocket real-time feed |

## Project Structure

```
roselet/
├── apps/web/              # Next.js frontend
│   └── src/app/
│       ├── page.tsx       # Home page
│       ├── plant/         # Plant a rose
│       ├── garden/        # Garden view
│       ├── rose/[id]/     # Rose detail
│       └── login/         # Login page
├── crates/backend/        # Rust Axum backend
│   ├── src/
│   │   ├── routes/        # API handlers
│   │   ├── models/        # Data models
│   │   ├── auth.rs        # JWT authentication
│   │   └── state.rs       # Application state
│   └── migrations/        # SQL migrations
├── justfile               # Task automation
└── Cargo.toml             # Rust workspace
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
