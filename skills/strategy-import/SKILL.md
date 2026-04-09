---
name: strategy-import
description: Import strategy documents into Open Horizons as structured graph nodes via OH MCP tools or the REST API.
---

# Strategy Import

Import strategy documents (markdown, org files, pasted text) into an Open Horizons instance as structured endeavors with hierarchy.

## When to Use

- You have strategy documents in markdown and want them in your OH graph
- You're setting up a new OH instance and want to bootstrap it from existing docs
- You're syncing strategy from a GitHub repo into OH

## Prerequisites

- A running Open Horizons instance (default: `http://localhost:3000`)
- Node types configured (via Settings UI, `STRATEGY_PRESET` env var, or `NODE_TYPES_FILE`)

## Process

### Choosing Your Interface

If you have the **OH MCP server** connected (check for `oh_create_endeavor` tool availability), use MCP tools as the primary interface. They are faster, don't require knowing the base URL, and handle auth automatically.

If MCP is not available, fall back to the REST API with curl.

| Operation | MCP Tool | REST Fallback |
|-----------|----------|---------------|
| List node types | `oh_get_endeavors` + inspect types | `GET /api/node-types` |
| List existing endeavors | `oh_get_endeavors(context_id)` | `GET /api/dashboard?contextId=<id>` |
| Create endeavor | `oh_create_endeavor(title, type, parent_id, context_id)` | `POST /api/endeavors/create` |
| Set parent | `oh_set_parent(endeavor_id, parent_id)` | `PUT /api/endeavors/<id>/parent` |
| Update description | `oh_update_endeavor(endeavor_id, description)` | `PATCH /api/endeavors/<id>` |
| Verify result | `oh_get_endeavor(endeavor_id)` | `GET /api/endeavors/<id>` |

### Step 1: Discover the Target

**With MCP:**
```
oh_get_endeavors(context_id: "default")
```
This returns the current graph and reveals what node types are in use.

**With REST:**
```bash
curl -s http://localhost:3000/api/node-types | jq '.nodeTypes[] | {slug, name, valid_children, valid_parents}'
curl -s http://localhost:3000/api/about | jq '.coreModel.hierarchy'
curl -s 'http://localhost:3000/api/dashboard' | jq '[.nodes[] | {title, node_type}]'
```

**You MUST query node types before creating anything.** The create endpoint validates `type` against the configured node types. If you send a type that doesn't exist, you get a 400.

### Step 2: Read the Source Document

Read the user's strategy document. It might be:
- A markdown file with heading-based hierarchy
- A pasted block of text
- Multiple files from a directory

**Identify the structure:**
- Heading levels typically map to hierarchy depth
- `# Mission` → top-level node type
- `## Strategic Bet` → second-level node type
- `### Capability` → third-level node type
- Content under each heading → the endeavor's description

**Map headings to configured node types.** Don't assume the default types — use what you discovered in Step 1. If the document uses terms like "Goal" or "Objective" that don't match configured slugs, ask the user how to map them.

### Step 3: Plan the Import

Before creating anything, show the user what you'll create:

```markdown
## Import Plan

Source: strategy.md
Target: http://localhost:3000

Will create:
1. Mission: "Build the operating system for strategic alignment"
2. Strategic Bet: "Open source the strategy graph" (parent: #1)
3. Strategic Bet: "Make it agent-native" (parent: #1)
4. Capability: "Self-hostable deployment" (parent: #2)
5. Capability: "MCP integration" (parent: #3)

Node type mapping:
- H1 → mission
- H2 → strategic_bet
- H3 → capability

Proceed? [y/n]
```

Wait for user confirmation before creating anything.

### Step 4: Create Endeavors

Create in **parent-first order** so parent IDs are available for children.

**With MCP (preferred):**
```
# Create root node
result = oh_create_endeavor(title: "Build the OS for strategic alignment", type: "mission", context_id: "default")
# result.id is the endeavor ID

# Create child with parent
oh_create_endeavor(title: "Open source the strategy graph", type: "strategic_bet", parent_id: result.id, context_id: "default")

# Update description
oh_update_endeavor(endeavor_id: "<id>", description: "Full description text...")
```

**With REST:**
```bash
# Create
curl -s -X POST http://localhost:3000/api/endeavors/create \
  -H 'Content-Type: application/json' \
  -d '{"title": "...", "type": "mission", "contextId": "default"}'

# Set parent
curl -s -X PUT http://localhost:3000/api/endeavors/<child-id>/parent \
  -H 'Content-Type: application/json' \
  -d '{"parentId": "<parent-id>"}'

# Update description
curl -s -X PATCH http://localhost:3000/api/endeavors/<id> \
  -H 'Content-Type: application/json' \
  -d '{"description": "Full description text..."}'
```

### Step 5: Verify

**With MCP:**
```
oh_get_endeavor(endeavor_id: "<root-id>")
```
This returns the endeavor and its children — confirm the full tree.

**With REST:**
```bash
curl -s 'http://localhost:3000/api/dashboard' | jq '[.nodes[] | {title, node_type, parent_id}]'
```

Report what was created and any issues encountered.

## Interface Reference

### MCP Tools (preferred)

| Tool | Arguments | Description |
|------|-----------|-------------|
| `oh_create_endeavor` | `title`, `type`, `parent_id?`, `context_id?` | Create an endeavor |
| `oh_update_endeavor` | `endeavor_id`, `title?`, `description?` | Update title or description |
| `oh_set_parent` | `endeavor_id`, `parent_id` | Set or change parent |
| `oh_get_endeavors` | `context_id` | List all endeavors in a context |
| `oh_get_endeavor` | `endeavor_id` | Get endeavor details + children |
| `oh_get_contexts` | (none) | List available contexts |

### REST API (fallback)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/node-types` | List configured node types with valid parent/child relationships |
| `GET` | `/api/about` | Instance info including hierarchy shape |
| `GET` | `/api/dashboard?contextId=<id>` | All endeavors in a context |
| `POST` | `/api/endeavors/create` | Create an endeavor (`title`, `type`, `contextId`, `parentId`) |
| `PATCH` | `/api/endeavors/<id>` | Update endeavor fields (e.g., `description`) |
| `PUT` | `/api/endeavors/<id>/parent` | Set or change parent (`parentId`) |
| `GET` | `/api/endeavors/<id>` | Get endeavor details |
| `GET` | `/api/contexts` | List available contexts |

## Important Constraints

1. **Type must be a configured slug.** Query `/api/node-types` first. Don't assume `mission/aim/initiative/task` — the instance may have custom types like `strategic_bet`, `capability`, `outcome_spec`.

2. **Create parents before children.** You need the parent's `endeavorId` to set `parentId` on the child.

3. **One context at a time.** Each endeavor belongs to a context. Default is `"default"` for the shared context, or `"personal:<user-id>"` for personal contexts.

4. **Description is set separately.** The create endpoint accepts `title`, `type`, `contextId`, and `parentId`. Use `PATCH /api/endeavors/<id>` to set the description after creation.

5. **Idempotency is your responsibility.** The API does not deduplicate by title. If you run the import twice, you'll get duplicates. Check the dashboard first if re-running.

## Heading-to-Type Mapping Heuristics

When the document doesn't explicitly name node types, use heading depth:

| Heading Level | Typical Mapping |
|--------------|-----------------|
| `#` (H1) | Root type (first in sort order) |
| `##` (H2) | Second-level type |
| `###` (H3) | Third-level type |
| `####` (H4) | Fourth-level type (if configured) |

If the document has more heading levels than configured node types, collapse the deepest levels into the leaf type.

If the document uses explicit type names in headings (e.g., `## Initiative: Build X`), prefer the explicit name over depth-based inference.

## Example

Given this markdown:

```markdown
# Build the OS for Strategic Alignment

Our mission is to make strategy executable.

## Open Source the Strategy Graph

Release OH as a self-hostable, forkable strategy tool.

### Self-Hostable Deployment

Single Docker Compose, no vendor lock-in.

### Plugin Architecture

Extensible via MCP and agent skills.

## Make It Agent-Native

Agents should be first-class strategy participants.

### MCP Integration

Full graph access via JSON-RPC.
```

And these configured types: `mission` → `strategic_bet` → `capability`

The skill would create:
1. `mission`: "Build the OS for Strategic Alignment"
2. `strategic_bet`: "Open Source the Strategy Graph" (parent: 1)
3. `capability`: "Self-Hostable Deployment" (parent: 2)
4. `capability`: "Plugin Architecture" (parent: 2)
5. `strategic_bet`: "Make It Agent-Native" (parent: 1)
6. `capability`: "MCP Integration" (parent: 5)

## Installation

```bash
npx skills add open-horizon-labs/open-horizons-oss --skill strategy-import
```
