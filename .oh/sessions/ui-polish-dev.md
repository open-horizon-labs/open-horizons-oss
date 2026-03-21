# Dev Pipeline -- UI Polish (#38, #39, #40, #43)
**Issue:** #38, #39, #40, #43
**PR:** (filled in Phase 2)
**Started:** 2026-03-21

## Phase 1: Problem Statement
Four UI polish issues that together form a coherent "v0.1 polish" pass:

1. **#38 Context dropdown truncation** -- The `w-48` class on the ContextSwitcher Dropdown is too narrow. Context names like "Default Context" get clipped.
2. **#39 Generic 404 page** -- The not-found page hard-codes an endeavor-specific message. Should be generic.
3. **#40 Settings page content** -- General Settings is an empty shell. Needs app version, git SHA, and DB status.
4. **#43 App footer** -- No footer exists. Need branding, GitHub link, version, copyright.

**Acceptance criteria:**
- Context dropdown shows full names without truncation
- 404 page uses generic "Page not found" language
- /settings shows app version, git SHA, DB connection status
- Root layout has a minimal footer with branding and version
- Dockerfile passes GIT_SHA build arg
- All changes in a single PR referencing #38, #39, #40, #43

## Phase 2: Solution Space
Single approach: direct CSS/component fixes. No architectural decisions needed.

## Phase 3: Execute
(in progress)

## Phase 4: Ship
(pending)

## RNA Tool Friction Log
| Phase | Tool | What happened | Workaround | Severity |
|-------|------|---------------|------------|----------|
