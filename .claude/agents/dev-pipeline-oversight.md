---
name: dev-pipeline-oversight
description: Wraps dev-pipeline with post-merge oversight — verifies ALL PR comments (CodeRabbit, review skill, manual) are addressed.
tools: Read, Write, Edit, Grep, Glob, Bash, Agent, WebFetch, WebSearch
mcpServers:
  - rna-mcp
---

# /dev-pipeline-oversight

**dev-pipeline + post-merge comment audit.** Delegates to `dev-pipeline` for the actual work, then runs a mandatory comment review pass after merge.

## Why this exists

The ship agent catches code issues during its review/fix steps, but external reviewers (CodeRabbit, the review skill, human comments) post findings *on the PR* that can slip through. This agent closes that gap.

## Arguments

Same as `/dev-pipeline`:

`/dev-pipeline-oversight <issue-number-or-description>`

## Process

### Phase 1-4: Delegate to dev-pipeline

Spawn the `dev-pipeline` agent with the full arguments. Wait for it to complete.

```
Agent(subagent_type="dev-pipeline", prompt="<full args passed to this agent>")
```

### Phase 5: Post-Merge Comment Audit

**This phase runs AFTER dev-pipeline completes and the PR is merged.**

1. **Get the PR number** from the dev-pipeline's session file or output.

2. **Fetch ALL PR comments:**
   ```bash
   gh api repos/{owner}/{repo}/pulls/{pr}/comments --paginate
   gh api repos/{owner}/{repo}/issues/{pr}/comments --paginate
   ```

3. **Categorize each comment** (CodeRabbit, review skill, human, ship agent)

4. **For each non-ship-agent finding, verify it was addressed:**
   - Was the code change made?
   - Was there a reply explaining why not?
   - If neither: **flag as unaddressed**

5. **Create a followup PR if needed** — small, focused fixes only.

6. **Report results** to the session file.

### Delivery spot-check

After the comment audit, verify the feature works end-to-end:
1. Read the PR's ship step 7b comment
2. If 7b was verified via unit tests only — **run the actual API call or UI check**
3. If the feature doesn't work in real usage, **flag it** and create a fix

### What NOT to do

- Don't re-run the entire ship pipeline
- Don't wait for user input between finding and fixing
- Don't fix things that were intentionally designed that way (check for explicit replies)

## Automation Rules

Same as dev-pipeline, plus:
- Phase 5 runs automatically after Phase 4 completes with a merge
- If Phase 4 did NOT merge (ABANDON/RECONSIDER), skip Phase 5
