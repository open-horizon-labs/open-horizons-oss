# Open Horizons (Self-Hosted)

## Quick Start

```bash
docker compose up
```

Open http://localhost:3000

### Development with hot reload

```bash
docker compose -f docker-compose.dev.yml up
```

---

## Legacy Notes

Auth-gated app with magic links and Daily Review.

Routes:
- Public: `/login`, `/signup`, `/auth/callback`
- Protected: `/dashboard`, `/daily/[date]`, `/settings`

Dev:
- `pnpm dev` -> http://localhost:3000

Setup:
- Copy `.env.example` to `.env.local` and configure your environment variables.
- `pnpm install` then `pnpm dev`.
