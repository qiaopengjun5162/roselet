# Roselet

A community icebreaker web app: plant roses (gratitude), buds (hope), and thorns (anxiety) to grow a shared garden.

[中文文档](README_zh.md)

## Tech Stack

- **Backend**: Rust 1.85+ / Axum / SQLx / PostgreSQL
- **Frontend**: Next.js 15 + shadcn UI + Tailwind CSS
- **Real-time**: WebSocket (tokio broadcast)
- **Auth**: JWT (jsonwebtoken)

## Quick Start

### Prerequisites

- Rust 1.85+ (stable)
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
| POST | `/api/auth/register` | Register (nickname → JWT) |
| GET | `/api/user/profile` | Get profile + stats (JWT) |
| POST | `/api/rose` | Plant a rose |
| PUT | `/api/rose/:id` | Edit rose (owner only) |
| DELETE | `/api/rose/:id` | Delete rose (owner only) |
| GET | `/api/rose/:id` | Get a single rose |
| POST | `/api/rose/:id/like` | Like / unlike (JWT) |
| GET | `/api/garden?color=&page=&per_page=` | Get garden (paginated, filterable) |
| GET | `/api/my/roses?page=&per_page=` | Get my roses (JWT) |
| GET | `/api/ws` | WebSocket real-time feed |

## Project Structure

```
roselet/
├── apps/web/              # Next.js frontend
│   └── src/app/
│       ├── page.tsx       # Home page
│       ├── plant/         # Plant a rose
│       ├── garden/        # Garden view (with color filter)
│       ├── rose/[id]/     # Rose detail + like
│       ├── my/            # My garden
│       ├── profile/       # User profile + stats
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
