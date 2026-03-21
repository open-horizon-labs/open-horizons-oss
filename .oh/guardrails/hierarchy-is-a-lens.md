---
id: hierarchy-is-a-lens
outcome: configurable-hierarchy
severity: hard
statement: The graph is flexible — any node can connect to any other via edges. Node type hierarchy is advisory (UI hints), not enforced at the DB level.
---

## The Pattern

There is no FK from `endeavors.node_type` to `node_types.slug`. There is no CHECK constraint
limiting which node types can be parents of which. The `valid_children` and `valid_parents` fields
in `node_types` control which "+Create" buttons the UI shows — nothing more.

This is deliberate. The graph models reality, and reality doesn't follow strict hierarchies.
A Capability can support multiple Strategic Bets. An Outcome Spec can trace back to two Capabilities.
Enforcing a strict tree would make the graph lie about the actual structure of strategy.

## Override Protocol

None. If someone wants strict hierarchy enforcement, they build it in the application layer
(e.g., a validation hook), not in the database schema. The graph itself stays flexible.

## Evidence

Real-world strategy graphs have cross-cutting capabilities. A strict tree would force
false choices about where to put them.
