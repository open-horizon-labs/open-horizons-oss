---
name: ship
description: Quality gate from implementation to merge. 13-step pipeline grounded in outcomes, metis, guardrails, ADRs, delivery verification, and final comment sweep.
tools: Read, Write, Edit, Grep, Glob, Bash, Agent
mcpServers:
  - rna-mcp
  - oh-mcp
isolation: worktree
---

# /ship Pipeline

The full quality gate for this project. 13 steps. Run sequentially — each step must complete before the next begins. **Do not wait for user prompts between steps.**

> **You are an RNA power user.** Before every Grep or Read for code understanding, ask: "Is there an RNA tool for this?" Use `search`, `search_symbols`, `graph_query`, and `outcome_progress` as your FIRST choice. **Every Grep/Read you use instead of an RNA tool is a friction event — log it to `.oh/friction-logs/`.**

## Arguments

`/ship <PR-number>` — run the pipeline against a specific PR.

If no PR number given, detect it from the current branch:
`gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number'`.

## Pre-flight

Before starting:
1. Read `AGENTS.md` for current project patterns and constraints
2. Read the linked issue and identify the outcome this work serves; inspect `.oh/outcomes/` for the relevant outcome and success signal
3. Read relevant `.oh/metis/` entries for the area being changed
4. Read relevant `.oh/guardrails/` entries for active constraints
5. Read `docs/adr/` if present and relevant to the changed area; if no ADRs exist, note that explicitly
6. Identify the PR, branch, and issue being closed
7. Read the PR description and issue acceptance criteria
8. Check for CodeRabbit review comments on the PR

## The 13 Steps

### 1. /review
Check implementation against the collected alignment context: outcomes, metis, guardrails, ADRs, graph impact, and acceptance criteria.

At minimum, the review must answer:
- Does this change advance the linked outcome or merely change code?
- Does it honor relevant metis and guardrails?
- Does it conflict with any accepted ADR, or reveal that an ADR is now missing?
- Are changed callers, consumers, and delivery surfaces still correct?

**Post findings as PR comment**, explicitly including:
- outcome alignment
- metis honored/violated
- guardrails honored/violated
- ADR alignment or ADR gap
- acceptance criteria status
- concrete findings with verdict `CONTINUE / ADJUST / PAUSE / SALVAGE`

### 2. /dissent
Seek contrary evidence against the proposed merge, grounded in the same local learnings.

The dissent pass must explicitly test:
- whether the current recommendation conflicts with existing metis or guardrails
- whether the outcome linkage is weak or performative
- whether missing ADRs, metis, or guardrails should be created because this PR is teaching the team something durable

**Post findings as PR comment.** If dissent surfaces a new durable learning or missing constraint, capture it before merge or file the exact follow-up.

### 3. Fix
Address ALL findings from review, dissent, AND CodeRabbit. No deferred items.

### 3b. Mark PR ready
```bash
gh pr ready <PR>
```

### 4. Adversarial test
Dissent-seeded tests that try to break the implementation. **Post results as PR comment.**

### 5. Merit assessment
Is this worth merging? Verdict: MERGE / MERGE WITH CAVEATS / ABANDON.

This is not just code quality. Re-check whether the final diff is aligned with the linked outcome, still consistent with metis/guardrails/ADRs, and worth the operational and conceptual cost of carrying it.

**Post as PR comment.**

### 6. Resolve TODOs
Every TODO, caveat, missing-learning note, and "needs more work" item must be fixed, recorded as a new metis/guardrail/ADR follow-up with explicit reasoning, or marked N/A with reasoning.

### 7a. Manual verification
Run the feature with real data. Not unit tests — real queries, real UI, real output.

For this project: verify the API endpoint works with curl, check the UI renders correctly.

### 7b. Delivery verification
**Verify the feature is visible to agents through MCP tools.**

Checklist (for any feature that adds/changes data visible to agents):
- [ ] Data persists to database
- [ ] API endpoint returns the new data
- [ ] MCP endpoint includes the new method or returns updated data
- [ ] oh-mcp-server can read/write the new data (test with `OH_API_KEY=dummy`)

If the PR doesn't add agent-visible data, mark N/A.

### 8. README
Update README.md for any new capability.

### 9. Smoke test
`pnpm build` and `pnpm test` must pass.

### 10. CI green
`gh pr checks <PR>` must pass.

### 10b. Final comment sweep
Verify ALL PR comments (CodeRabbit, humans) are addressed before merge.

### 11. Merge
Re-read acceptance criteria. Every checkbox checked off.
```bash
gh pr merge <PR-number> --squash --delete-branch
```

## Automation Rules
- **Do not wait** for user prompts between steps.
- **Post to PR** after each substantive step.
- **Every review pass must be grounded** in the collected local knowledge: outcome, metis, guardrails, and relevant ADRs.
- **Stop and ask** only if: ABANDON/RECONSIDER/SALVAGE verdict, or CI fails after 2 fix attempts.
- **Record metis** if the pipeline surfaces a new learning: write to `.oh/metis/<slug>.md`.
- **Record a guardrail candidate or ADR follow-up** if the pipeline discovers a reusable constraint or one-way-door decision that is not yet documented.

## Session Persistence
Write progress to `.oh/sessions/<pr-number>-ship.md`.
