# AGENTS.md — Open Horizons OSS

Guidance for AI agents working in this codebase. For setup and architecture, see README.md.

## MCP Tools — Use These First

Two MCP servers are configured. Use them as your PRIMARY interface. Don't fall back to curl/Grep/Read when an MCP tool exists.

### OH MCP (oh-mcp-server) — Strategy Graph

| Operation | Tool |
|-----------|------|
| List workspaces | `oh_get_contexts` |
| List endeavors | `oh_get_endeavors` |
| Get endeavor + children | `oh_get_endeavor` |
| Full context (ancestors, metis, guardrails) | `oh_get_dive_context` |
| Create endeavor | `oh_create_endeavor` |
| Update title/description | `oh_update_endeavor` |
| Move in hierarchy | `oh_set_parent` |
| Log a decision | `oh_log_decision` |
| Surface a pattern | `oh_create_metis_candidate` |
| Surface a constraint | `oh_create_guardrail_candidate` |

### RNA MCP (repo-native-alignment) — Code Understanding

| Operation | Tool |
|-----------|------|
| Find code by intent | `search(query)` |
| Find symbols | `search_symbols(query, kind)` |
| Trace dependencies | `graph_query(node, "neighbors")` |
| Blast radius | `graph_query(node, "impact")` |
| Outcome progress | `outcome_progress(outcome_id)` |
| Repo orientation | `repo_map()` |

**Friction rule:** Every Grep/Read or curl you use instead of an MCP tool is a friction event. Log it per `.claude/skills/friction.md`.

## Alignment Artifacts (.oh/)

- **Outcomes** (`.oh/outcomes/`) — what we're trying to achieve. Has `id`, `status`, `mechanism`, `files`.
- **Guardrails** (`.oh/guardrails/`) — constraints. `hard` = non-negotiable, `soft` = recommended.
- **Metis** (`.oh/metis/`) — patterns/learnings, human-curated. Agents propose candidates; humans promote.
- **Sessions** (`.oh/sessions/`) — working memory for pipeline runs.
- **Friction logs** (`.oh/friction-logs/`) — MCP tool adoption tracking.

## Agent Workflows

| Workflow | Agent | Use when |
|----------|-------|----------|
| Full feature delivery | `/dev-pipeline-oversight` | New features, complex changes |
| Ship a ready PR | `/ship` | PR exists, needs quality gate |
| Log friction | `/friction` | MCP tool failed or was skipped |

## Rules

- Node types are data in the `node_types` table — don't hardcode type names
- No Supabase, no Vercel, no external auth — ever (hard guardrail)
- Use `lib/db.ts` for all database access — `query()`, `queryOne()`, `execute()`, `getClient()`
- Tag commits `[outcome:X]` when work serves a declared outcome
- Don't skip the ship pipeline — every PR gets the quality gate
- Strategy graph models strategy, not execution — see `.oh/guardrails/strategy-not-execution.md`
