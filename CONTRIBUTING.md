# Contributing

## Prerequisites

- Node.js 20+
- pnpm
- Docker (for the database)

## Setup

```bash
# Start Postgres
docker compose up db -d

# Install dependencies
pnpm install

# Start dev server (port 3000)
pnpm dev
```

The dev server connects to Postgres at the `DATABASE_URL` in your environment. Docker Compose sets this to `postgresql://oh_user:oh_password@localhost:5432/open_horizons`.

## Running Tests

```bash
pnpm test          # Unit tests (jsdom environment)
pnpm test:api      # API integration tests (node environment, sequential)
pnpm lint          # ESLint
pnpm build         # Production build (runs contract validation)
```

API tests (`__tests__/api/`) run against a real database and use a shared test harness (`api-harness.ts`) that starts the Next.js server. They run sequentially (`maxWorkers: 1`) to avoid port conflicts.

Unit tests (`__tests__/unit/`) run in jsdom and do not require a database.

## Project Structure

```
app/
  api/              Next.js API routes (REST + JSON-RPC MCP endpoint)
  (pages)           Next.js app router pages
  components/       React components
  settings/         Settings pages (node types, import)
lib/
  config/           Node type presets and configuration helpers
  contracts/        Zod schemas for request/response validation
  db.ts             Postgres connection pool (pg)
  auth-api.ts       Auth wrapper (pass-through in OSS, no real auth)
  import/           Markdown import types
  graph/            Graph traversal utilities
db/
  schema.sql        Database schema
  seed.sql          Seed data
packages/
  ui/               Shared UI components
```

## Database Access

All database access goes through `lib/db.ts`. It exports four functions:

- `query(sql, params)` -- returns rows
- `queryOne(sql, params)` -- returns first row or null
- `execute(sql, params)` -- returns affected row count
- `executeReturning(sql, params)` -- returns rows from INSERT/UPDATE...RETURNING
- `getClient()` -- gets a pool client for transactions

Do not import `pg` directly in API routes.

## Commit Conventions

When your work serves a declared outcome in `.oh/outcomes/`, tag the commit:

```
[outcome:self-hostable-strategy-graph] Add Docker health checks
```

This is optional but helps track which commits contribute to which strategic goals.

## PR Quality Gate

Every PR goes through a quality gate before merge. The gate checks:

1. Tests pass
2. Build succeeds (includes contract validation)
3. No regressions in existing functionality
4. Code is consistent with project patterns

## Key Design Decisions

These are non-negotiable constraints:

- **No vendor lock-in.** No Supabase, no Vercel, no external auth. Everything runs on generic Postgres + Docker.
- **Hierarchy is a lens.** Node type parent/child relationships are advisory (UI hints), not enforced in the database. Any node can connect to any other node.
- **Node types are data.** They live in the `node_types` table, not in code. Do not hardcode type names.
- **Strategy, not execution.** The graph models strategy. Execution artifacts (sprint tasks, assignees, due dates) belong in delivery tools.

## Adding a New API Route

1. Create the route file in `app/api/`
2. Wrap handlers with `withAuth` from `lib/auth-api.ts` (even though auth is a pass-through, the wrapper is used consistently)
3. Add Zod contracts in `lib/contracts/` if the route has structured request/response shapes
4. Add API tests in `__tests__/api/`
5. Document in README.md if the route is part of the public API

## Tech Stack

Next.js 15, React 19, TypeScript, PrimeReact, Tailwind CSS, PostgreSQL (via `pg`), Zod for validation.
