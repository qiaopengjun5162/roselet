# Roselet

![Rust](https://img.shields.io/badge/Rust-1.88.0-orange?logo=rust)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![License](https://img.shields.io/badge/License-MIT-blue)
![Live](https://img.shields.io/badge/Live-online-brightgreen)

> Write one line, plant a rose, and come back in a week to see what you have grown.

Roselet is a community mood garden. It turns the classic "Rose, Bud, Thorn" icebreaker into a garden
that grows over time: gratitude goes into the petals, hopes into the bud, anxieties into the thorns.
Others can see them, send roses, leave likes — and a week later you can look back at the shape of
your own month.

[中文文档](README_zh.md) | **Live demo:** [https://roselet.47.131.238.0.sslip.io](https://roselet.47.131.238.0.sslip.io)

## Current Status

- Stage: `Beta live`
- Live URL: [https://roselet.47.131.238.0.sslip.io](https://roselet.47.131.238.0.sslip.io) (HTTPS, web and API on the same origin)
- Fallback: `http://47.131.238.0` (same host, no TLS, troubleshooting only)
- Current focus: `Core Web product is publicly usable; collecting real user feedback`
- ⚠️ Two older URLs must not be shared anymore: `roselet-web.vercel.app` does not resolve
  from mainland China, and `roselet.paxonqiao.com` no longer exists (NXDOMAIN).

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

- **Web frontend + Rust backend**: one AWS Lightsail box; Caddy splits by path on the same origin
  (`/api/*`, `/health` → 3001, everything else → 3000). Same origin buys two things:
  no CORS, and no mixed-content blocking when the page is served over https.
- **Database**: Docker PostgreSQL on Lightsail (daily 04:00 dump + weekly restore drill)
- **Entry point**: [https://roselet.47.131.238.0.sslip.io](https://roselet.47.131.238.0.sslip.io)
  (Caddy issues the Let's Encrypt cert); swap in a real domain with `scripts/enable-tls-domain.sh`
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
- 💳 **Agent payments** — Solana Devnet x402 paid reflection API and MCP tool backed by Rust WASM
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
| Agent API | Hono + x402 SVM + MCP + Solana Devnet USDC |
| Sound | Tone.js synthesizer |
| Deploy | Vercel + AWS Lightsail + Docker + Caddy |

## Quick Start

### Live Demo

Try it now: [https://roselet.47.131.238.0.sslip.io](https://roselet.47.131.238.0.sslip.io)

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
just agent-check   # typecheck + test the Solana x402 Agent API
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

Measured 2026-11-23 (all green):

| Suite | Passing | Command |
|-------|---------|---------|
| Backend unit | 94 (+1 ignored) | `cargo test --workspace --lib` |
| Backend integration | 84 | `cargo test -p roselet-backend --test api_test -- --test-threads=1` |
| Rust recommend / WASM | 172 | `cargo test -p roselet-recommend` |
| Web frontend | 455 | `pnpm --filter web test` |
| Miniprogram | 71 | `pnpm --filter @roselet/miniprogram test` |
| Agent API | 39 | `pnpm --filter @roselet/agent-api test` |
| Worker API | 20 | `pnpm --filter @roselet/worker-api test` |
| **Total** | **935** | — |

**Before running backend integration tests**:

1. **Run serially** — the tests `TRUNCATE` the same tables, so parallel runs
   erase each other's data. Use `-- --test-threads=1` (or `cargo nextest ... -j1`
   as CI does).
2. **Start with a clean test database** — if a since-deleted migration left a
   version behind, sqlx fails with `VersionMissing(15)`-style errors:

   ```bash
   dropdb --if-exists roselet_test && createdb roselet_test
   ```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
