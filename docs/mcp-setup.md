# MCP Server Setup

Open Horizons exposes a lightweight MCP-compatible JSON-RPC endpoint at `/api/mcp`. This lets AI agents (Claude Desktop, custom scripts, the standalone [oh-mcp-server](https://github.com/open-horizon-labs/oh-mcp-server)) read your endeavor graph.

## Quick start

1. Start the app (`pnpm dev` or via Docker).
2. Point your MCP client at `http://localhost:3000/api/mcp`.
3. Authenticate with a Bearer token (session cookie or API key).

## Authentication

Every request must include an `Authorization` header:

```
Authorization: Bearer ak_YOUR_API_KEY
```

API keys are created in **Settings > API Keys** inside the app.
Session cookies also work when requests originate from the same browser.

## JSON-RPC protocol

Send a POST to `/api/mcp` with a JSON body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "list_endeavors",
  "params": {}
}
```

The response follows JSON-RPC 2.0:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { "endeavors": [...] }
}
```

## Available methods

### `list_endeavors`

List endeavors, optionally filtered.

| Param        | Type   | Required | Description                        |
|-------------|--------|----------|------------------------------------|
| context_id  | string | no       | Filter by context                  |
| node_type   | string | no       | Filter by type (Mission, Aim, etc) |
| limit       | number | no       | Max results (default 100)          |

**Example:**

```json
{"method": "list_endeavors", "params": {"context_id": "personal:abc", "node_type": "Aim"}}
```

### `get_endeavor`

Get a single endeavor with its children.

| Param | Type   | Required | Description  |
|-------|--------|----------|-------------|
| id    | string | yes      | Endeavor ID |

**Response includes:** the endeavor (with `parent_id`), and a `children` array.

### `get_tree`

Get the full hierarchy for a context as a nested tree.

| Param      | Type   | Required | Description |
|-----------|--------|----------|-------------|
| context_id | string | yes      | Context ID  |

**Response includes:**
- `tree` -- nested nodes with `children` arrays (roots at top level)
- `flat_nodes` -- flat list with `parent_id` on each node
- `edges` -- raw edge records

### `search_endeavors`

Full-text search across titles and descriptions.

| Param      | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| query     | string | yes      | Search term              |
| context_id | string | no       | Limit to a context       |
| limit     | number | no       | Max results (default 20) |

## Claude Desktop configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "open-horizons": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer ak_YOUR_API_KEY"
      }
    }
  }
}
```

See also the example config at `mcp-config.example.json` in the repo root.

## Standalone oh-mcp-server

The external [oh-mcp-server](https://github.com/open-horizon-labs/oh-mcp-server) can connect in two modes:

### 1. Via the app API (recommended)

Point it at this endpoint. The MCP server proxies requests through the app, which handles auth and RLS.

```bash
OH_API_URL=http://localhost:3000
OH_API_KEY=ak_YOUR_API_KEY
```

### 2. Via direct Postgres connection

For self-hosted deployments where the MCP server runs alongside the database:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/open_horizons
```

This bypasses the app layer entirely. Useful for read-only tooling and scripts that need direct SQL access. Make sure the database user has appropriate read permissions.

## Environment variables

| Variable           | Description                                  |
|-------------------|----------------------------------------------|
| `NEXT_PUBLIC_APP_URL` | Base URL of the app (for MCP server config) |
| `DATABASE_URL`       | Direct Postgres URL (for oh-mcp-server)     |

No additional environment variables are needed for the built-in `/api/mcp` endpoint -- it uses the app's existing database connection and auth.
