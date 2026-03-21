# Dev Pipeline -- API test speed: single shared server

**Issue:** #46
**PR:** (filled in Phase 2)
**Started:** 2026-03-21

## Phase 1: Problem Statement

Each of 7 API test files spawns its own Next.js dev server in `beforeAll`. With `maxWorkers: 1` and 30-60s startup per server, the suite takes 10+ minutes and sometimes times out in CI.

**Acceptance Criteria:**
- The Next.js server starts ONCE for the entire API test suite (via Jest globalSetup)
- The server is stopped ONCE after all tests complete (via Jest globalTeardown)
- Test files read the server URL from a shared env var / file instead of starting their own
- `pnpm test:api` still works locally with no extra manual steps
- CI workflow continues to work without changes (or minimal changes)
- Full API test suite completes in under 2 minutes
- Use `next build` + `next start` (production mode) for faster boot times

## Phase 2: Solution Space

### Candidates

1. **Band-aid: Shared port file** -- Keep `next dev`, but have only the first test file start the server and write port to a file. Others detect existing port and skip startup. Fragile; depends on test execution order.

2. **globalSetup with `next dev`** -- Move server lifecycle to Jest globalSetup/globalTeardown. Still uses dev server, so 30-60s startup, but only once. Moderate improvement.

3. **globalSetup with `next build` + `next start`** (SELECTED) -- Build the app once in globalSetup, then run `next start` which boots in 2-3s. All test files read the port from env var. Major speed improvement. Clean separation. The build step adds ~20-30s but only happens once, and `next start` boots almost instantly.

4. **Test containers / external server** -- Run tests against a pre-built Docker container. Overkill for this project size.

**Selected: Candidate 3** -- globalSetup with `next build` + `next start`. Best balance of speed and simplicity.

## Phase 3: Execute
(in progress)

## Phase 4: Ship
(pending)

## RNA Tool Friction Log
| Phase | Tool | What happened | Workaround | Severity |
|-------|------|---------------|------------|----------|
