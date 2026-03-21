---
id: strategy-not-execution
outcome: configurable-hierarchy
severity: soft
statement: The strategy graph models strategy, not execution. Execution artifacts belong in delivery tools.
---

## The Pattern

The graph should stop at Outcome Spec (or equivalent leaf node). Tasks, plans, initiatives,
and other execution artifacts belong in the delivery layer (Linear, GitHub Issues, Jira, etc.).

The strategy graph answers: Why? Where are we investing? What must we be able to do? How will we know?
The delivery layer answers: What are we building this sprint? Who's working on what? When is it due?

## Override Protocol

If a team explicitly wants execution tracking in the graph (e.g., they don't use a separate delivery tool),
they can add Task or Initiative node types. The graph is flexible — this is a recommendation, not a blocker.

## Evidence

Feedback from early pilot: "Seven levels is too deep. The graph should stop at Outcome Spec
and let the delivery system handle the rest."
