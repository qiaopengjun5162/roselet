# Roselet Release Process

## Release Rule

Production is released intentionally from a versioned release, not as a side effect of routine feature work.

## Version Source

Git tag and GitHub Release are the source of truth.

## Pre-Release Checks

- Run focused backend tests for changed Rust code.
- Run focused Web tests for changed frontend code.
- Run `pnpm --filter web typecheck` for Web changes.
- Run `NEXT_PUBLIC_API_URL=https://roselet.47.131.238.0.sslip.io pnpm --filter web build:cf` for Cloudflare Pages changes.

## Manual Smoke Test

- Home opens.
- Login/register works.
- Garden loads.
- Create rose works.
- New rose detail opens from public garden.
- My garden opens own rose.
- Feedback submits from About.
- Admin `/stats` shows feedback inbox.
- Normal user cannot access `/stats`.

## Production Release

1. Create tag, for example `v0.2.0`.
2. Write user-facing GitHub Release notes.
3. Trigger or allow production deployment.
4. Smoke test Vercel and Cloudflare.
5. Record result in `DEVLOG.md`.

## Rollback

- Frontend: roll back Vercel/Cloudflare to previous successful deployment.
- Backend: recreate backend with previous GHCR image.
- Database: avoid irreversible migrations unless a rollback plan is documented.
