---
id: self-hostable-strategy-graph
status: active
mechanism: |-
  Docker Compose brings up Postgres + Next.js. Node types are configurable
  via Settings UI. No auth, no vendor lock-in, no external dependencies.
files:
  - docker-compose.yml
  - Dockerfile
  - db/schema.sql
  - db/seed.sql
  - app/settings/node-types/
  - app/api/node-types/
---

# Self-Hostable Strategy Graph

Teams can deploy a strategy graph on their own infrastructure with `docker compose up`,
configure their hierarchy through the UI, and start modeling their strategy immediately.

## Why This Matters

Strategy lives in documents and people's heads. Getting it into a queryable graph that
agents can traverse is the gap. Self-hosting removes the barrier of platform lock-in,
auth complexity, and vendor dependencies.

## Signals

- Time from clone to running instance < 5 minutes
- Node type changes take effect without restart or code changes
- Works behind corporate firewalls with no external API calls required

## Constraints

- No Supabase, no Vercel, no external auth providers
- Generic Postgres only
- MIT license
