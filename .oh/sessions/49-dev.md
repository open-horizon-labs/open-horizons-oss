# Dev Pipeline -- User-configurable lens presets
**Issue:** #49
**PR:** (pending)
**Started:** 2026-03-21

## Phase 1: Problem Statement

PR #48 removed the hardcoded Quick Lenses preset bar (Strategic / Tactical / All) because its top-half/bottom-half split did not produce meaningful groupings across different node type presets. Users need a way to define their own lens presets that map a label to a set of node types so they can quickly filter the dashboard.

**Acceptance Criteria:**
- Users can create, edit, and delete named lens presets
- Presets persist across sessions
- Presets are available from the dashboard filter area
- Works correctly regardless of which node type hierarchy is active

## Phase 2: Solution Space

### Candidate 1: localStorage-only presets (lightweight)
Store user-defined lens presets in localStorage. No DB changes. Quick to ship.
- Pro: No migration, no API work, immediate persistence
- Con: Per-browser only, no sharing across devices
- **Selected: Yes** -- Matches the existing pattern (dashboard filters already use localStorage)

### Candidate 2: DB-backed presets with API
New `lens_presets` table, full CRUD API.
- Pro: Cross-device, shareable
- Con: Schema migration, more code, overkill for v1

### Candidate 3: Context-scoped DB presets
Like #2 but scoped to contexts.
- Pro: Different contexts get different presets
- Con: Even more complexity

### Decision
**Candidate 1** -- localStorage-only. This matches the existing pattern where dashboard filters use localStorage. Can be upgraded to DB-backed later. Replaces the hardcoded LensPresetBar with a user-editable version.

## Phase 3: Execute
(in progress)

## Phase 4: Ship
(pending)

## RNA Tool Friction Log
| Phase | Tool | What happened | Workaround | Severity |
|-------|------|---------------|------------|----------|
