---
name: friction
description: Log MCP tool friction. Track when OH or RNA tools fail, frustrate, or get skipped.
---

# /friction

Log a friction event with MCP tools. This is how the products improve — every friction point is signal.

## Two MCP tools, two kinds of friction

This repo uses two MCP servers:
- **OH MCP** (oh-mcp-server) — strategy graph: endeavors, contexts, metis, guardrails, candidates
- **RNA MCP** (repo-native-alignment) — code understanding: search, symbols, graph queries, outcome progress

Both should be used as PRIMARY tools for their domain. Falling back to curl/Grep/Read when an MCP tool exists is friction.

## The Rule

**Before every manual API call or code search, ask: "Is there an MCP tool for this?"**

- If yes and you use it → great
- If yes and it fails → log the failure
- If yes and you skip it → **log why you skipped it**
- If no tool applies → no log needed

## How to Log

Write friction to `.oh/friction-logs/<pipeline-or-context>.md`.

```markdown
# Friction Log: <context>
**Date:** <date>
**Pipeline/Issue:** #<number> or <description>

| Phase/Step | MCP Server | Tool | What happened | Workaround | Severity |
|------------|-----------|------|---------------|------------|----------|
```

**Severity levels:**
- **blocker** — had to abandon the tool entirely
- **friction** — worked around it, cost time or context window
- **papercut** — minor annoyance, still usable
- **skipped** — didn't try the MCP tool; used manual approach instead

## OH MCP Quick Reference

| Need | OH MCP tool | Manual approach is friction if... |
|------|------------|----------------------------------|
| Get strategy tree | `oh_get_endeavors` | You curl /api/dashboard instead |
| Create endeavor | `oh_create_endeavor` | You curl /api/endeavors/create instead |
| Log a decision | `oh_log_decision` | You curl /api/logs instead |
| Get metis/guardrails | `oh_get_dive_context` | You curl /api/endeavors/:id/extensions |
| Surface a pattern | `oh_create_metis_candidate` | You curl /api/candidates instead |
| Surface a constraint | `oh_create_guardrail_candidate` | You curl /api/candidates instead |

## RNA MCP Quick Reference

| Need | RNA tool | Grep/Read is friction if... |
|------|---------|---------------------------|
| Find code by intent | `search(query)` | You Grep for keywords |
| Find symbols | `search_symbols(query, kind)` | You Grep for `function `, `class ` |
| Trace dependencies | `graph_query(node, "neighbors")` | You Read imports manually |
| Check outcome progress | `outcome_progress(outcome_id)` | You Read `.oh/outcomes/` manually |
| Find guardrails | `search(query, artifact_types=["guardrail"])` | You Grep `.oh/guardrails/` |
