# Problem Statements -- Hackathon Feedback
**Source:** Theron hackathon feedback
**Started:** 2026-04-08

## Phase 1: Problem Statement

This artifact intentionally records the feedback as problem statements only. It does not adopt the suggested fixes.

### Theme
Users can get value from Open Horizons once its rules are known, but several first-contact workflows currently depend on implicit knowledge. The result is avoidable debugging during API integration, local environment reset, and GitHub-driven sync.

### Problem 1: Create endpoint success does not reflect persisted state

**Current framing:** `POST /api/endeavors/create` should accept `parent_id` and `description`, or fail loudly instead of requiring follow-up API calls.

**Reframed as:** API clients need a truthful create contract, but the create flow currently returns success while dropping caller-supplied fields, so consumers cannot trust that accepted input was actually persisted.

**The shift:** From "support these fields in one call" to "eliminate silent divergence between request shape, success signaling, and stored state."

#### Constraints
- **Hard:** A successful write response must not imply fields were applied when they were ignored.
- **Hard:** API behavior must be debuggable without requiring reverse-engineering from side effects.
- **Soft:** The current multi-call create → update description → set parent workflow is fixed.

#### What this framing enables
- Evaluate the create contract around truthfulness, atomicity, and visibility of partial support.
- Compare persistence, validation, and error semantics without assuming the current request shape is correct.
- Treat silent field dropping as a product reliability problem, not just an inconvenience.

#### What this framing excludes
- Relying on tribal knowledge that certain fields require separate follow-up calls.
- Treating a nominally successful create response as sufficient evidence that the requested structure exists.

### Problem 2: Type vocabulary is not discoverable at integration time

**Current framing:** The API should expose valid type values more clearly because integrators are guessing and getting 400s.

**Reframed as:** API consumers cannot discover the valid endeavor type vocabulary from the product surface they are using, so first-time integrations fail through trial and error instead of through an explicit contract.

**The shift:** From "add a specific discoverability mechanism" to "make the authoritative type vocabulary visible wherever integrations validate or fail."

#### Constraints
- **Hard:** Invalid type submissions must be understandable to callers without source-diving or insider knowledge.
- **Hard:** The system needs one authoritative vocabulary for endeavor creation at the point of API use.
- **Soft:** Type discoverability has to come from a dedicated endpoint versus documentation or validation responses.

#### What this framing enables
- Evaluate how humans and scripts learn valid types before and during API calls.
- Align validation behavior, API documentation, and runtime error reporting around the same vocabulary.
- Measure success in terms of reduced guesswork during first integration.

#### What this framing excludes
- Assuming users will infer valid values from internal conventions or UI terminology.
- Treating repeated 400 responses as an acceptable discovery mechanism.

### Problem 3: Local reset semantics are unclear and leave persistent state behind

**Current framing:** The README should better explain how to fully reset Docker state because `docker volume prune` leaves the Postgres data behind.

**Reframed as:** Developers trying to return to a clean local environment cannot tell which reset steps actually remove persisted Open Horizons state, so they believe they are testing from scratch when prior database state still exists.

**The shift:** From "document command X" to "make reset semantics explicit, predictable, and matched to actual persistence behavior."

#### Constraints
- **Hard:** Named Docker volumes persist unless explicitly removed; any reset guidance must reflect that reality.
- **Hard:** A reset workflow must not imply a clean slate when durable state remains.
- **Soft:** The current reset vocabulary and command sequence are fixed.

#### What this framing enables
- Evaluate setup and reset instructions by whether they produce the state users think they produced.
- Distinguish between ephemeral cleanup and true data reset in docs, scripts, or tooling.
- Treat local-environment predictability as part of product onboarding, not separate from it.

#### What this framing excludes
- Assuming Docker users already know which cleanup commands do or do not remove named volumes.
- Counting a reset flow as successful when the user still carries hidden prior state.

### Problem 4: Configured node types do not propagate through the write API

**Current framing:** `POST /api/endeavors/create` should accept custom node type slugs such as `strategic_bet`, `capability`, and `outcome_spec`.

**Reframed as:** Open Horizons lets users configure custom node type vocabulary in settings, but API writes still validate against primitive types, so external sync workflows cannot create graph data using the same domain language the product presents.

**The shift:** From "accept these extra slugs" to "unify node type behavior across configuration, validation, and graph creation so the system has one usable vocabulary end-to-end."

#### Constraints
- **Hard:** Node types are configured data, not just display labels.
- **Hard:** A workflow that writes graph data through the API must not require callers to translate back to a different internal vocabulary than the one shown in the product.
- **Soft:** GitHub-driven sync is the only workflow that matters here.

#### What this framing enables
- Evaluate whether settings, persisted node-type configuration, and API validation all share the same source of truth.
- Assess import and sync workflows as first-class product behavior rather than one-off scripts.
- Separate display customization from actual capability support and close the gap deliberately.

#### What this framing excludes
- Treating display-layer customization as sufficient when write paths still operate on a different model.
- Leaving external sync clients to maintain permanent primitive-to-custom type mapping logic outside the product boundary.


## Phase 2: Solution Space
**Updated:** 2026-04-08

> Using `/solution-space`: explore multiple candidate approaches, compare trade-offs, and recommend the right altitude before implementation.

## Solution Space Analysis

**Problem:** Hackathon users can succeed with Open Horizons, but several first-contact workflows still depend on implicit knowledge rather than truthful, discoverable contracts.
**Key Constraint:** Fix the highest-leverage gaps without prematurely committing to the wrong layer when the report and current code disagree.

### Candidates Considered

> The four feedback items do not need one monolithic fix. The best decomposition is targeted issues by failure mode.

| Issue | Candidate | Level | Approach | Trade-off |
|------|-----------|-------|----------|-----------|
| Problem 1 | A | Local Optimum | Patch `description`/`parent` handling only in create route | Fast, but risks preserving silent contract drift |
| Problem 1 | B | Reframe | Make create contract strict and truthful end-to-end | Slightly larger change, but fixes the root cause |
| Problem 2 | A | Band-Aid | Add more docs only | Cheap, but discoverability still depends on finding the docs |
| Problem 2 | B | Local Optimum | Add one authoritative discoverability surface at integration time | Requires choosing and testing the right API/docs surface |
| Problem 3 | A | Local Optimum | Clarify README reset semantics and clean-slate commands | Docs-only, but fully matches the reported failure mode |
| Problem 4 | A | Band-Aid | Assume create route is broken and patch it directly | High risk of fixing the wrong layer |
| Problem 4 | B | Reframe | Reproduce the custom-type failure, then fix the actual write-path or release drift | Requires investigation first, but avoids cargo-cult patching |

### Evaluation

**Problem 1 — Create contract truthfulness**
- Option A solves the symptom only partially.
- Option B solves the stated problem: accepted input must either persist or fail loudly.
- Recommendation: choose Option B. The route currently bypasses the shared create contract and inserts an empty `description`, so a contract cleanup is the correct altitude.

**Problem 2 — Type vocabulary discoverability**
- Docs already exist (`README.md`, `docs/node-types.md`) and the current create route already returns valid type slugs on invalid input.
- The pain is real, but the missing piece is likely integration-time discoverability rather than the total absence of documentation.
- Recommendation: choose Option B. Add one authoritative discoverability path where integrators already are, instead of sprinkling more hints.

**Problem 3 — Local reset semantics**
- This is the most obvious item. The report matches Docker named-volume behavior exactly.
- Recommendation: choose Option A. Clarify reset semantics in docs and distinguish between cleanup and true clean-slate reset.

**Problem 4 — Custom node type write-path drift**
- Current `main` and `v0.1.1` both validate create-time `type` against the `node_types` table by slug or name, so the reported failure does not match the current create-route implementation.
- That makes a direct patch to `/api/endeavors/create` the wrong default. Possible causes now are: stale deployment, different failing write path, sync/import wrapper drift, or node-type state mismatch at runtime.
- Recommendation: choose Option B. Reproduce first, then fix the failing layer.

### Recommendation

**Selected:** Split into four focused issues with different altitudes.
**Level:** Mixed — Local Optimum for Problems 1-3, Reframe-first for Problem 4.

**Rationale:**
- Problem 1 is a contract-truthfulness bug with a clear source in the current route.
- Problem 2 is a real discoverability problem, but not yet tied to a single obvious mechanism.
- Problem 3 is a straightforward docs/onboarding fix.
- Problem 4 needs reproduction because the reported behavior conflicts with both `main` and `v0.1.1`.

**Accepted trade-offs:**
- We are not forcing one umbrella fix for all discoverability issues.
- We are treating the custom-type report as credible user feedback while still requiring code-path verification before implementation.

### Implementation Notes

- For Problem 1, prefer cutover to the shared create contract in `lib/contracts/endeavor-contract.ts` over further route-local validation drift.
- For Problem 2, pick one authoritative discoverability surface and make docs/runtime point to the same truth.
- For Problem 3, document outcome-based reset levels (`cleanup` vs `clean slate`), not just commands.
- For Problem 4, verify whether the failure is in deployed/latest, a different write path, or runtime state before editing code.

## Plan
**Updated:** 2026-04-08
**Issues:** #51, #52, #53, #56

- #51 `Make endeavor create contract truthful and explicit`
  - https://github.com/open-horizon-labs/open-horizons-oss/issues/51
- #52 `Make endeavor type vocabulary discoverable at integration time`
  - https://github.com/open-horizon-labs/open-horizons-oss/issues/52
- #53 `Clarify Docker reset semantics for clean-slate local setup`
  - https://github.com/open-horizon-labs/open-horizons-oss/issues/53
- ~~#54 `Investigate and fix custom node type write-path drift`~~ — **closed**, does not reproduce on main. Root cause: fresh-install seed gap.
- #56 `Support custom node type seeding at deploy time`
  - https://github.com/open-horizon-labs/open-horizons-oss/issues/56
  - Replaces #54. Approach: `STRATEGY_PRESET` selects from `NODE_TYPES_FILE` (custom JSON) or built-in presets.