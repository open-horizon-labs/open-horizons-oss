---
id: configurable-hierarchy
status: active
mechanism: |-
  Node types stored in node_types DB table, managed via Settings > Node Types UI
  and /api/node-types API. Dashboard, lens filters, and child creation buttons
  all derive dynamically from the data. No code changes or restarts needed.
files:
  - db/schema.sql
  - app/api/node-types/
  - app/settings/node-types/
  - app/components/DashboardClient.tsx
  - app/components/LensFilter.tsx
  - lib/config/
  - lib/constants/icons.ts
---

# Configurable Hierarchy

Node types are data, not code. Users define their own strategy hierarchy through
the UI or API — the graph adapts immediately.

## Why This Matters

Different organizations think about strategy differently. Some use Mission > Aim > Initiative.
Others use Mission > Strategic Bet > Capability > Outcome Spec. The graph should model
how THEY think, not impose a structure.

## Signals

- Preset loading replaces all types atomically, no restart
- Custom types created via UI appear in dashboard immediately
- Icons, colors, descriptions, parent-child relationships all configurable
- Dashboard sections, lens filters, and create buttons are fully data-driven

## Constraints

- The hierarchy is a lens, not a constraint — any node can connect to any node via edges
- Node types with existing endeavors cannot be deleted (protect data integrity)
- Built-in presets serve as starting points, not requirements
