# Roselet

![Rust](https://img.shields.io/badge/Rust-1.88.0-orange?logo=rust)
![Next.js] ![Taro](https://img.shields.io/badge/Taro-4-0ab?logo=taro) ![WASM](https://img.shields.io/badge/WASM-Rust-654ff0?logo=webassembly)(https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![License](https://img.shields.io/badge/License-MIT-blue)

> Plant a rose, share your emotions, wait for the universe to respond.

Roselet is a community icebreaker Web app inspired by the classic "Rose, Bud, Thorn" game. Users plant roses to share gratitude, anxiety, and hope — forming a living community garden that grows with every entry.

[中文文档](README_zh.md)

## Game Rules

| Icon | Name | Meaning |
|------|------|---------|
| 🌹 | **Rose** | Something that made you happy or grateful this week |
| 🌵 | **Thorn** | Something causing you anxiety or that you need help with |
| 🌱 | **Bud** | Something you're looking forward to or a new idea you want to explore |

## Features

- 🌹 **Plant** — Choose a color (red/white/yellow), fill in any combination of rose/thorn/bud
- 🏡 **Garden** — Browse all roses with color filter and real-time WebSocket updates
- 🔐 **Auth** — Nickname-based registration, JWT auth; planting and liking require login
- ❤️ **Like** — Express resonance with others' roses
- ✏️ **Manage** — Edit or delete your own roses
- 🤖 **AI Reply** — Personalized async AI response after each planting (OpenAI-compatible API)
- 🧠 **WASM Recommend** — Client-side smart recommendation powered by Rust → WASM (112KB)
- 🎵 **Sound** — Tone.js synthesizer: plant/like/notify sounds + background music
- 🌌 **Dynamic Background** — Day-night gradient that shifts through 8 time stages (dawn → dusk → deep night)
- ✨ **Fireworks** — Particle burst animation on successful plant
- 👤 **Profile** — Personal garden and planting statistics
- 📖 **Swagger** — Interactive API docs at `/swagger`
- 🐳 **Docker** — One-command deployment via Docker Compose

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust 1.85+ / Axum / SQLx / PostgreSQL |
| Frontend | Next.js 16 / Tailwind CSS / shadcn UI |
| Real-time | WebSocket (tokio broadcast) |
| Auth | JWT (jsonwebtoken v9) |
| AI | OpenAI-compatible API (async, non-blocking) |
| WASM | Rust → wasm-bindgen → wasm-pack (112KB) |
| Sound | Tone.js synthesizer |
| Deploy | Docker Compose |

## Quick Start

### Requirements

- Rust 1.85+ (stable)
- Node.js 22+
- pnpm
- PostgreSQL 16+

### Install

```bash
git clone https://github.com/qiaopengjun5162/roselet.git
cd roselet
just db-init    # create database + run migrations
just dev        # start backend (3001) + frontend (3000)
```

### Common Commands

```bash
just dev           # start dev environment
just test          # run all tests (72 backend + 20 frontend)
just check-all     # fmt + lint + audit + test
just pre-commit    # pre-commit checks
just db-reset      # reset database
just wasm          # build WASM recommendation module
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://localhost/roselet` | PostgreSQL connection string |
| `JWT_SECRET` | — | JWT signing secret (required in production) |
| `PORT` | `3001` | Backend port |
| `OPENAI_API_KEY` | — | AI reply key (optional; skipped if absent) |
| `OPENAI_BASE_URL` | — | OpenAI-compatible API base URL |
| `OPENAI_MODEL` | — | Model name |

### Docker

```bash
docker-compose up --build
```

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (DB connectivity + version) |
| POST | `/api/auth/register` | Register / login by nickname → JWT |
| GET | `/api/user/profile` | User profile + stats (JWT required) |
| POST | `/api/rose` | Plant a rose (JWT required) |
| PUT | `/api/rose/:id` | Edit rose (owner only) |
| DELETE | `/api/rose/:id` | Delete rose (owner only) |
| GET | `/api/rose/:id` | Get single rose |
| POST | `/api/rose/:id/like` | Toggle like (JWT required) |
| GET | `/api/garden` | Garden list (paginated, color filter) |
| GET | `/api/my/roses` | My roses (JWT required, paginated) |
| GET | `/api/ws` | WebSocket real-time push |
| GET | `/swagger` | Swagger UI (OpenAPI 3.0) |

## Project Structure

```
roselet/
├── apps/web/                   # Next.js frontend
│   └── src/
│       ├── app/
│       │   ├── page.tsx        # Home (rules + entry)
│       │   ├── plant/          # Plant page (auth-gated)
│       │   ├── garden/         # Garden (filter + real-time)
│       │   ├── rose/[id]/      # Rose detail (edit/delete/like)
│       │   ├── my/             # My garden
│       │   ├── profile/        # Profile + stats
│       │   └── login/          # Login / register
│       ├── components/
│       │   ├── rose-card.tsx   # Shared rose card (glass dark theme)
│       │   ├── fireworks.tsx   # Particle burst on plant success
│       │   ├── day-night-bg.tsx# Dynamic day-night background
│       │   └── nav.tsx         # Navigation bar
│       └── lib/
│           ├── api.ts          # API client
│           ├── sound.ts        # Tone.js sound system
│           ├── ws.ts           # WebSocket client
│           └── recommend.ts    # WASM loader
├── crates/
│   ├── backend/                # Rust Axum backend
│   │   ├── src/
│   │   │   ├── routes/         # API handlers
│   │   │   ├── models/         # Data models
│   │   │   ├── auth.rs         # JWT
│   │   │   ├── ai.rs           # AI reply generation
│   │   │   └── state.rs        # App state
│   │   └── migrations/         # SQL migrations
│   └── recommend/              # Rust WASM recommendation module
├── justfile                    # Task automation
└── Cargo.toml                  # Rust workspace
```

## Tests

| Suite | Count | Command |
|-------|-------|---------|
| Backend integration | 36 | `cargo nextest run -j1` |
| Backend unit | 36 | included above |
| Frontend unit | 20 | `pnpm test` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
