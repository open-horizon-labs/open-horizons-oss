# Open Horizons

A self-hostable strategy graph for aligning work to organizational strategy.

![Screenshot](docs/screenshot.png)

## Quick Start

```bash
docker compose up
```

Open [http://localhost:3000](http://localhost:3000).

For development with hot reload:

```bash
docker compose -f docker-compose.dev.yml up
```

## What is this?

Open Horizons models your organization's strategy as a directed graph. Nodes represent units of work at different levels of abstraction -- missions, aims, initiatives -- and edges encode the relationships between them. The graph is displayed as a navigable tree, giving teams a shared view of how daily execution connects to strategic intent.

The built-in MCP endpoint lets AI agents read and traverse your strategy graph, so tools like Claude, Cursor, or custom agents can ground their work in organizational context without manual copy-paste.

No authentication is required. Open Horizons is designed to run on your own infrastructure, behind your own network boundary.

## Features

- **Strategy graph** -- Tree visualization of your full strategic hierarchy, from mission down to tasks or outcomes.
- **Configurable node types** -- Choose a preset or define your own hierarchy. Ship with two built-in presets.
- **MCP endpoint** -- JSON-RPC API at `/api/mcp` for AI agent integration. Agents can list, search, and traverse the graph.
- **Markdown import** -- Import strategy documents as structured graph nodes.
- **REST API** -- Full CRUD for endeavors, edges, contexts, and dashboard data.
- **Docker deployment** -- Single `docker compose up` brings up the app and Postgres.

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | (set by Docker Compose) | PostgreSQL connection string |
| `STRATEGY_PRESET` | `open-horizons` | Active node type hierarchy |

### Strategy Presets

**`open-horizons`** -- The default. A purpose-driven hierarchy:

```
Mission > Aim > Initiative > Task
```

**`agentic-flow`** -- Designed for AI-native and agentic workflows:

```
Mission > Strategic Bet > Capability > Tactical Plan > Outcome
```

Set the preset via environment variable:

```bash
STRATEGY_PRESET=agentic-flow docker compose up
```

Or in `docker-compose.yml`:

```yaml
environment:
  STRATEGY_PRESET: agentic-flow
```

### Custom Presets

Add a new file in `lib/config/presets/`, implement the `StrategyConfig` interface, and register it in `lib/config/index.ts`.

## API

### REST Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard` | Full graph for the dashboard |
| GET | `/api/endeavors/:id` | Get a single endeavor |
| POST | `/api/endeavors/create` | Create an endeavor |
| PATCH | `/api/endeavors/:id` | Update an endeavor |
| DELETE | `/api/endeavors/:id` | Delete an endeavor |
| GET/POST | `/api/edges` | List or create edges |
| GET/POST | `/api/contexts` | List or create contexts |
| GET | `/api/status` | Health check |

### MCP (JSON-RPC)

`POST /api/mcp` accepts JSON-RPC 2.0 requests. Available methods:

- `list_endeavors` -- List endeavors with optional filters (`context_id`, `node_type`, `limit`).
- `get_endeavor` -- Get an endeavor and its children by `id`.
- `get_tree` -- Get the full tree for a `context_id`.
- `search_endeavors` -- Full-text search by `query`.

Example:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_tree","params":{"context_id":"default"}}'
```

## Development

```bash
pnpm install
pnpm dev          # Start dev server on http://localhost:3000
pnpm build        # Production build (includes contract validation)
pnpm test         # Run unit tests
pnpm lint         # Lint
```

Requires Node 20+ and pnpm.

## Architecture

```
app/
  api/              Next.js API routes (REST + MCP)
  (pages)           Next.js app router pages
lib/
  config/           Node type system and strategy presets
  contracts/        Zod schemas for request/response validation
  db.ts             Postgres connection pool (pg)
  graph/            Graph traversal utilities
  validation/       Input validation helpers
db/
  schema.sql        Database schema (loaded by Docker on init)
  seed.sql          Seed data
```

Built with Next.js 15, React 19, TypeScript, PrimeReact, Tailwind CSS, and PostgreSQL.

## License

MIT
