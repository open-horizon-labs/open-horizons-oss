# Concepts

Open Horizons models strategy as a directed graph. This page defines the core terms.

## Endeavor

A node in the strategy graph. Every unit of work -- from a top-level mission to a specific task -- is an endeavor. Each endeavor has a title, description, node type, and belongs to a context.

Endeavors are stored in the `endeavors` table with a UUID primary key.

## Context

A workspace that contains endeavors. Contexts isolate groups of endeavors from each other -- think of them as separate strategy boards. A context has a title and description.

Every endeavor belongs to exactly one context.

## Edge

A directed relationship between two endeavors. The most common edge type is `contains`, which creates parent-child relationships and produces the tree view in the UI.

Edges have a `relationship` field (e.g., `contains`), optional weight, and metadata. Self-loops are not allowed. The same pair of endeavors can have multiple edges as long as each has a different relationship type.

## Node Type

A configurable category for endeavors. Node types define the hierarchy levels in your strategy graph (e.g., Mission > Aim > Initiative > Task).

Each node type has:
- **slug** -- machine identifier (e.g., `strategic_bet`)
- **name** -- display name (e.g., "Strategic Bet")
- **valid_children / valid_parents** -- advisory hints for the UI. These control which "+Create" buttons appear, but are not enforced at the database level. Any node can connect to any other node via edges.

Node types are data in the `node_types` table, not hardcoded. See [Node Types](node-types.md) for configuration details.

## Metis

A pattern, insight, or learning attached to an endeavor. Named after the Greek concept of practical wisdom. Metis entries are human-curated -- they represent things your team has learned that should influence future decisions.

Stored in the `metis_entries` table.

## Guardrail

A constraint or rule attached to an endeavor. Guardrails define what must or must not happen. They are reference material for decision-making, not automated enforcement.

Stored in the `guardrails` table.

## Candidate

A proposed metis or guardrail, typically created by an AI agent. Candidates start with `pending` status and go through human review: they are either promoted (becoming a full metis entry or guardrail) or rejected.

This is the mechanism for AI agents to suggest learnings without directly modifying curated knowledge.

## Log

A decision record, note, or progress update tied to an endeavor. Logs are timestamped markdown entries that create an audit trail of thinking and decisions over time.

Each log has a `log_date` (the date the decision applies to) and a `content` field (markdown).
