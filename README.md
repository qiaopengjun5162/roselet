# Roselet

![Rust](https://img.shields.io/badge/Rust-1.88.0-orange?logo=rust)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![License](https://img.shields.io/badge/License-MIT-blue)
![Live](https://img.shields.io/badge/Live-roselet--web.vercel.app-brightgreen)

> Plant a rose, share your emotions, wait for the universe to respond.

Roselet is a community icebreaker Web app inspired by the classic "Rose, Bud, Thorn" game. Users plant roses to share gratitude, anxiety, and hope — forming a living community garden that grows with every entry.

[中文文档](README_zh.md) | **Live demo:** [https://roselet-web.vercel.app](https://roselet-web.vercel.app)

## Current Status

- Stage: `Beta live`
- Live URL: [https://roselet-web.vercel.app](https://roselet-web.vercel.app)
- Current focus: `Core Web product is publicly usable; collecting real user feedback`

### Progress

```text
Overall         [########--] 75%
Product         [#########-] 90%
Engineering     [#########-] 90%
Production      [##########] 98%
Miniprogram     [#####-----] 50%
User validation [#---------] 20%
```

### Production Architecture

- **Web frontend**: Vercel — [https://roselet-web.vercel.app](https://roselet-web.vercel.app)
- **Rust backend**: AWS Lightsail (Docker + Axum)
- **Database**: Docker PostgreSQL on Lightsail
- **HTTPS**: Caddy + `roselet.47.131.238.0.sslip.io` temporary domain
- **Auto deploy**: GitHub Actions builds GHCR image → SSH deploy to Lightsail

Deployment docs: [docs/AWS_LIGHTSAIL_DEPLOYMENT.md](docs/AWS_LIGHTSAIL_DEPLOYMENT.md)

### Next Steps

1. Collect real user feedback.
2. Watch `/stats` dashboard to see if we approach the 100-user milestone.
3. Close the miniprogram real-device loop.
4. Consider custom domain, backups, and monitoring.

### Historical Deploy Paths

Earlier we evaluated Cloudflare / Render / Neon free / card-less options. Those documents are now marked historical and no longer maintained. The current production line is AWS Lightsail.

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
| Deploy | Vercel + AWS Lightsail + Docker + Caddy |

## Quick Start

### Live Demo

Try it now: [https://roselet-web.vercel.app](https://roselet-web.vercel.app)

Screenshots: [docs/screenshots/](docs/screenshots/)

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
just test          # run all tests (461 total)
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

### Production Deploy

Current production runs on `Vercel Web + AWS Lightsail Rust backend + Docker Postgres + Caddy HTTPS`. See [docs/AWS_LIGHTSAIL_DEPLOYMENT.md](docs/AWS_LIGHTSAIL_DEPLOYMENT.md).

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
| Backend integration + unit | 110 | `cargo nextest run --workspace --all-features -j1` |
| Rust WASM / recommend | 139 | included above |
| Web frontend | 146 | `pnpm --filter @roselet/web test` |
| Miniprogram | 66 | `pnpm --filter @roselet/miniprogram test` |
| **Total** | **461** | `just test` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
