# Node Types

Node types define the levels of your strategy hierarchy. They are data in the database, not hardcoded in application code.

## How It Works

Each endeavor has a `node_type` field (e.g., "Mission", "Aim", "Initiative"). The `node_types` table defines what types exist and how they relate to each other.

Node types control:
- What the UI displays (icons, colors, chip styling)
- Which "+Create" buttons appear under a node (via `valid_children`)
- What parent options are suggested when moving a node (via `valid_parents`)

Node types do **not** enforce relationships at the database level. Any endeavor can connect to any other endeavor via edges, regardless of type. This is a deliberate design decision -- the hierarchy is a lens for viewing strategy, not a constraint on how strategy can be structured.

## Built-in Presets

Two presets ship with the app. Load them from **Settings > Node Types** in the UI, or via the API.

### Open Horizons (default)

A classic strategy hierarchy focused on purpose-driven alignment.

| Level | Slug | Description |
|-------|------|-------------|
| Mission | `mission` | High-level purpose and direction |
| Aim | `aim` | Strategic objectives and measurable outcomes |
| Initiative | `initiative` | Active projects and work streams |
| Task | `task` | Specific actionable items |

### Agentic Flow

A four-level hierarchy designed for AI-native workflows. Stops at outcome specification -- execution belongs in delivery tools.

| Level | Slug | Description |
|-------|------|-------------|
| Mission | `mission` | Why we exist |
| Strategic Bet | `strategic_bet` | Where we are investing |
| Capability | `capability` | What we must be able to do |
| Outcome Spec | `outcome_spec` | How we will know it works |

For integrators creating endeavors, `GET /api/about` is the authoritative runtime source for the current create-time type slugs and canonical request field names. It reflects the live `node_types` table rather than a static preset description.


## Loading a Preset via API

```bash
# Get the preset definition (from the app's built-in presets)
# Then POST it to replace all node types

curl -X POST http://localhost:3000/api/node-types/load-preset \
  -H "Content-Type: application/json" \
  -d '{
    "nodeTypes": [
      {
        "slug": "mission",
        "name": "Mission",
        "description": "High-level purpose and direction",
        "icon": "🎯",
        "color": "#7c3aed",
        "chip_classes": "bg-purple-100 text-purple-800 border-purple-200",
        "valid_children": ["aim"],
        "valid_parents": [],
        "sort_order": 0
      }
    ]
  }'
```

The load-preset endpoint replaces all node types in a single transaction. Types that are in use by existing endeavors are updated in place rather than deleted.

## Creating Custom Types via API

```bash
# Create or update a single node type
curl -X POST http://localhost:3000/api/node-types \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "objective",
    "name": "Objective",
    "description": "A measurable goal",
    "icon": "🎯",
    "color": "#2563eb",
    "chip_classes": "bg-blue-100 text-blue-800 border-blue-200",
    "valid_children": ["key_result"],
    "valid_parents": ["mission"],
    "sort_order": 1
  }'
```

This uses upsert -- if a node type with that slug already exists, it updates all fields.

## Deleting a Type

```bash
curl -X DELETE http://localhost:3000/api/node-types \
  -H "Content-Type: application/json" \
  -d '{"slug": "objective"}'
```

Deletion fails with HTTP 409 if any endeavors currently use that type.

## Node Type Fields

| Field | Type | Description |
|-------|------|-------------|
| `slug` | string | Primary key. URL-safe identifier (e.g., `strategic_bet`) |
| `name` | string | Display name (e.g., "Strategic Bet") |
| `description` | string | What this type represents |
| `icon` | string | Emoji for compact display |
| `color` | string | Hex color for UI elements |
| `chip_classes` | string | Tailwind classes for chip/badge styling |
| `valid_children` | string[] | Slugs of types that can be created under this type |
| `valid_parents` | string[] | Slugs of types this can be nested under |
| `sort_order` | integer | Display order in lists and settings |

## The Advisory Model

The `valid_children` and `valid_parents` fields control UI behavior only:

- The "+Create" button under a Mission shows only types listed in that Mission type's `valid_children`.
- The parent picker when moving a node suggests only types listed in the node's `valid_parents`.

These are hints. The database has no foreign key from `endeavors.node_type` to `node_types.slug` and no constraint preventing any edge between any two nodes. You can create edges between any endeavors via the API regardless of their types.

This is intentional. Real strategy has cross-cutting concerns -- a capability can support multiple strategic bets, and an outcome spec can trace back to two capabilities. A strict tree would force false choices.
