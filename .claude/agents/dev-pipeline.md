---
name: dev-pipeline
description: Full dev pipeline from problem framing through merge. Ensures GitHub issue exists, explores solutions, executes, then ships with review grounded in outcomes, metis, guardrails, and ADRs.
tools: Read, Write, Edit, Grep, Glob, Bash, Agent, WebFetch, WebSearch
mcpServers:
  - rna-mcp
  - oh-mcp
isolation: worktree
---

# /dev-pipeline

> **IMPORTANT: This agent MUST run in a git worktree** so it doesn't conflict with other agents or the main working directory. The `isolation: worktree` frontmatter handles this automatically when spawned via Agent tool.

Full development pipeline: **problem-statement → solution-space → execute → ship.**

Takes a feature or bug from framing through merge. Each phase feeds the next via a session file. The pipeline ensures nothing is skipped — no coding without a problem statement, no merging without the /ship quality gate.

> **Friction logging:** When an RNA tool falls short or you fall back to Grep/Read, append to the session file's `## RNA Tool Friction Log` table.

## Arguments

`/dev-pipeline <issue-number-or-description>`

- If a GitHub issue number is given, read it as starting context.
- If a description is given, use it to frame the problem in Phase 1.

## Session File

All phases write to `.oh/sessions/<issue-number>-dev.md`.

Initialize at pipeline start:

```markdown
# Dev Pipeline — <title>
**Issue:** #<number> (or "pending")
**PR:** (filled in Phase 2)
**Started:** <timestamp>
**Outcome:** <outcome-id or explicit justification for none>
**Relevant Metis:** <paths or "none">
**Relevant Guardrails:** <paths or "none">
**Relevant ADRs:** <paths or "none">

## Phase 1: Problem Statement
(filled by Phase 1)

## Phase 2: Solution Space
(filled by Phase 2)

## Phase 3: Execute
(filled by Phase 3)

## Phase 4: Ship
(filled by Phase 4)

## RNA Tool Friction Log
| Phase | Tool | What happened | Workaround | Severity |
|-------|------|---------------|------------|----------|
```

---

## Phase 1: Problem Statement → GitHub Issue → Outcome

**Goal:** Ensure the work has a crisp problem statement in a GitHub issue, laddered to a declared outcome.

### If an issue number was provided:
1. Read the issue: `gh issue view <number>`
2. Does it have a clear problem statement? (outcome-focused, testable, solution-agnostic)
3. If yes — extract into session file.
4. If no — reframe it, update the issue body.

### If only a description was provided:
1. Frame the problem statement using `/problem-statement` thinking: what behavior changes, for whom, why now.
2. Create a GitHub issue with the problem statement, acceptance criteria, and outcome link.
3. Record issue number in session file.

### Ladder to an outcome:
Every issue must connect to a declared outcome. After creating/reading the issue:
1. Check `.oh/outcomes/` for existing outcomes this work serves.
2. If one exists — tag the issue with `[outcome:<id>]` in the title or body.
3. If none exists — ask: is this work worth doing without a declared outcome? If yes, note why. If no, create the outcome first.
4. Use `oh_create_endeavor` or `oh_log_decision` to record the linkage in the strategy graph.

**Gate:** Do not proceed without acceptance criteria AND an outcome linkage (or explicit justification for why none exists).

---

## Phase 2: Solution Space → PR Description

**Goal:** Explore candidates, draft a PR, and collect the alignment context the `ship` agent must review against.

1. Generate 3-4 candidates (band-aid → redesign)
2. Create feature branch and draft PR
3. Identify and record the relevant outcome, metis, guardrails, and ADRs in the session file
4. Update the PR description with the chosen solution and any alignment constraints or accepted trade-offs

**Gate:** Do not proceed without a draft PR and explicit alignment context recorded in the session file.

---

## Phase 3: Execute

**Goal:** Implement the chosen solution without drifting from the recorded alignment context.

1. Read session file for aim, problem, selected solution, outcome, metis, guardrails, and ADRs
2. Build in small increments, detect drift
3. If execution reveals a new durable learning or missing constraint, update the session file and record the metis/guardrail/ADR follow-up before handoff
4. Push commits to PR branch
5. Log to the OH strategy graph if creating decision records:
   ```bash
   curl -X POST http://localhost:3000/api/logs -H "Content-Type: application/json" \
     -d '{"entity_type":"endeavor","entity_id":"<id>","content":"<decision>"}'
   ```

**Gate:** Do not proceed if execution produces SALVAGE verdict.

---

## Phase 4: Ship

**Goal:** Quality gate and merge via the `ship` agent, with review explicitly grounded in the session's outcome, metis, guardrails, and ADR context.

> **CRITICAL: Spawn the ship agent. Do NOT inline the ship steps.**

Before spawning `ship`, make sure the session file and PR description clearly capture:
- linked outcome (or explicit justification for none)
- relevant metis
- relevant guardrails
- relevant ADRs or ADR gap
- accepted trade-offs from solution-space

```
Agent(subagent_type="ship", prompt="/ship <PR-number>\n\nSESSION FILE: .oh/sessions/<issue-number>-dev.md\nGround the review, dissent, merit, and follow-up decisions in the recorded outcome, metis, guardrails, and ADRs.")
```

This launches the full 13-step pipeline as an autonomous agent.

---

## Automation Rules

- **Do not wait** for user prompts between phases.
- **Stop and ask** only if: Phase 1 can't determine acceptance criteria, Phase 3 SALVAGE, Phase 4 ABANDON/CI fails.
- **Record metis** if any phase surfaces a new learning.

## Friction Reporting

At pipeline end, summarize friction events with recommendations.
