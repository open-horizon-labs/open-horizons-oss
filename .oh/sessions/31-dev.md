# Dev Pipeline -- Add logs/decisions display to endeavor detail page
**Issue:** #31
**PR:** #33
**Started:** 2026-03-21

## Phase 1: Problem Statement
Decision logs created via MCP (oh_log_decision) are stored in the database but the browser UI has no way to display them. Users who log decisions from Claude Code or other MCP clients cannot see those logs when viewing an endeavor in the browser.

**Acceptance Criteria:**
1. Endeavor detail page shows a "Logs" section with log entries for that endeavor
2. Logs fetched from existing `/api/logs?entity_id={endeavorId}&entity_type=endeavor`
3. Each log entry displays: content (markdown), date, content_type badge
4. Reverse chronological order (newest first)
5. Minimal/hidden empty state when no logs
6. Follows existing codebase patterns

## Phase 2: Solution Space
**Selected:** Standalone ActivityLog component in the Content tab.
- Create `ActivityLog.tsx` that fetches from `/api/logs?entity_id=X&entity_type=endeavor`
- Render logs as a chronological list with markdown content, date badge, content_type
- Place below Children/Siblings in the Content tab of EndeavorDetailClient
- Hide section entirely when no logs exist
**PR:** #33 (draft)

## Phase 3: Execute
- Created `app/components/ActivityLog.tsx` -- standalone component, 84 lines
- Integrated into `EndeavorDetailClient.tsx` -- import + single JSX line
- Type checks pass (no errors in changed files)
- Component hides itself when loading or when no logs exist
- Markdown rendered via ReactMarkdown (already a project dependency)

## Phase 4: Ship
(pending)

## RNA Tool Friction Log
| Phase | Tool | What happened | Workaround | Severity |
|-------|------|---------------|------------|----------|
