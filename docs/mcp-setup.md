# MCP Setup

Open Horizons has two MCP integration points:

1. A **built-in JSON-RPC endpoint** at `/api/mcp` for direct API access.
2. An **external MCP server** ([oh-mcp-server](https://github.com/open-horizon-labs/oh-mcp-server)) that provides stdio-based MCP tools for AI agents like Claude Desktop and Claude Code.

No authentication is required. The OSS version has no API keys, Bearer tokens, or RLS.

## Built-in JSON-RPC Endpoint

The app exposes a JSON-RPC 2.0 endpoint at `POST /api/mcp`.

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_tree","params":{"context_id":"default"}}'
```

### Available Methods

| Method | Params | Description |
|--------|--------|-------------|
| `list_endeavors` | `context_id?`, `node_type?`, `limit?` | List endeavors with optional filters |
| `get_endeavor` | `id` (required) | Get endeavor with its children and parent |
| `get_tree` | `context_id` (required) | Full hierarchy as nested tree |
| `search_endeavors` | `query` (required), `context_id?`, `limit?` | Text search across titles and descriptions |
| `list_metis` | `endeavor_id` (required) | Metis entries for an endeavor |
| `list_guardrails` | `endeavor_id` (required) | Guardrails for an endeavor |
| `create_candidate` | `endeavor_id`, `type`, `content` (all required) | Propose a metis or guardrail |
| `get_extensions` | `endeavor_id` (required) | Metis + guardrails for an endeavor |

## oh-mcp-server (Recommended for AI Agents)

The [oh-mcp-server](https://github.com/open-horizon-labs/oh-mcp-server) wraps the JSON-RPC endpoint in MCP stdio transport, which is what Claude Desktop and Claude Code expect.

### Quick Start

```bash
OH_API_URL=http://localhost:3000 OH_API_KEY=dummy npx oh-mcp-server
```

`OH_API_KEY` must be set to a non-empty string. The OSS version has no auth, but the MCP server requires the variable. Use any value (e.g., `dummy`).

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "open-horizons": {
      "command": "npx",
      "args": ["oh-mcp-server"],
      "env": {
        "OH_API_URL": "http://localhost:3000",
        "OH_API_KEY": "dummy"
      }
    }
  }
}
```

### Claude Code Configuration

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "oh-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["oh-mcp-server"],
      "env": {
        "OH_API_URL": "http://localhost:3000",
        "OH_API_KEY": "dummy"
      }
    }
  }
}
```

### Available Tools

When connected via oh-mcp-server, AI agents get these tools:

| Tool | Description |
|------|-------------|
| `oh_get_contexts` | List workspaces |
| `oh_get_endeavors` | List endeavors in a context |
| `oh_get_endeavor` | Get endeavor with children |
| `oh_get_dive_context` | Full context: ancestors, siblings, metis, guardrails |
| `oh_create_endeavor` | Create a new endeavor |
| `oh_update_endeavor` | Update title or description |
| `oh_set_parent` | Move an endeavor in the hierarchy |
| `oh_log_decision` | Log a decision to an endeavor |
| `oh_create_metis_candidate` | Propose a pattern or learning |
| `oh_create_guardrail_candidate` | Propose a constraint |
| `oh_get_logs` | Get recent logs for an endeavor |

### Streamable HTTP Configuration

If your MCP client supports HTTP-based MCP (not stdio), you can point directly at the JSON-RPC endpoint:

```json
{
  "mcpServers": {
    "open-horizons": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

See `mcp-config.example.json` in the repo root for a minimal example.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OH_API_URL` | For oh-mcp-server | URL of your Open Horizons instance |
| `OH_API_KEY` | For oh-mcp-server | Any non-empty string (no real auth in OSS) |
| `DATABASE_URL` | For the app | PostgreSQL connection string (set by Docker Compose) |
