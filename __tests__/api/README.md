# API Integration Tests

Real integration tests that start the Next.js app and test HTTP endpoints against a live Postgres database.

## Running

```bash
pnpm test:api
```

Requires `DATABASE_URL` pointing at a Postgres instance with the schema loaded (`db/schema.sql` + `db/seed.sql`).

## How It Works

- **Jest `globalSetup`** builds the app once (`next build`) and starts a single `next start` on port 3099
- All 7 test files share that server instance — no per-file server boot
- **Jest `globalTeardown`** kills the server after all tests complete
- Server info is stored in `.api-test-server.json` (gitignored)

## Test Files

| File | What it tests |
|------|---------------|
| `endeavors.api.test.ts` | Endeavor CRUD, hierarchy, context isolation |
| `edges.api.test.ts` | Edge creation, validation, cascading deletes |
| `parent-change.api.test.ts` | Reparenting endeavors |
| `context-rename.api.test.ts` | Context renaming propagation |
| `contract-validation.api.test.ts` | Zod contract validation on API responses |
| `enhanced-contract-validation.api.test.ts` | Extended contract checks |
| `contract-failure-simulation.api.test.ts` | Error response contracts |

## Architecture

The `ApiTestHarness` class in `api-harness.ts` provides:

- `makeRequest(path, options)` — HTTP requests against the test server
- `makeRequestWithKey(path, options)` — same, with API key header (no-op in OSS, no auth)
- Auto-detection of the shared server via `.api-test-server.json`

## CI

The CI workflow (`.github/workflows/ci.yml`) runs these tests with a Postgres service container. No external dependencies needed.
