---
id: ui-derives-from-data
outcome: configurable-hierarchy
---

If node types are configurable, the UI must be fully data-driven. No hardcoded type names in dashboard sections, lens filters, create buttons, or section headers. Derive everything from the actual `node_type` values in the graph data, ordered by hierarchy depth.

**What broke:** Dashboard had hardcoded `filterNodesByType(nodes, 'Mission')` and "+Aim" buttons. When Agentic Flow types (Strategic Bet, Capability, Tactical Plan, Outcome) were loaded, they had no sections and no create buttons. The fix: loop over unique `node_type` values from the data, compute hierarchy depth via BFS from root nodes, render sections dynamically.

**The rule:** If a value comes from `node_types`, no UI element should contain that value as a string literal.
