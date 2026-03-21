---
id: agent-queryable-strategy
status: active
mechanism: |-
  MCP JSON-RPC endpoint at /api/mcp exposes the graph to agents.
  oh-mcp-server connects via stdio transport for Claude/agent integration.
  Agents can read, search, traverse, and write to the strategy graph.
files:
  - app/api/mcp/route.ts
  - app/api/endeavors/
  - app/api/candidates/
  - docs/mcp-setup.md
  - mcp-config.example.json
---

# Agent-Queryable Strategy

AI agents can read, search, traverse, and write to the strategy graph via MCP,
so they ground their work in organizational context without manual copy-paste.

## Why This Matters

Agents working in a codebase need to know WHY they're building something, not just WHAT.
The strategy graph gives them a queryable answer to "what outcome does this serve?" and
"what constraints apply?" — making agent-generated work aligned by default.

## Signals

- Agents can traverse the full hierarchy via `get_tree`
- Agents can create endeavors, log candidates (metis/guardrails), and update descriptions
- oh-mcp-server connects with `OH_API_KEY=dummy` (no auth barrier)
- MCP tools return structured data agents can reason about

## Constraints

- MCP endpoint must be JSON-RPC 2.0 compliant
- No auth required for self-hosted instances
- Agents must be able to write (create, update), not just read
