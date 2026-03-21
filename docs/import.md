# Markdown Import

Open Horizons can import strategy documents written in markdown into the graph as endeavors with parent-child edges.

## Current Status

The markdown import feature requires an `OPENAI_API_KEY` environment variable for LLM-powered parsing and similarity matching. Without it, the import endpoints return HTTP 501.

The UI for import is at **Settings > Import from Markdown** and walks through a four-step process: input, preview, review, commit.

## How It Works

1. You paste or upload a markdown document.
2. The importer parses heading structure to identify endeavors and their hierarchy.
3. An LLM extracts structured data (title, summary, type, tactics, signals) from each section.
4. The system matches imported sections against existing endeavors using similarity scoring to avoid duplicates.
5. You review a preview of planned actions (insert, update, review, skip) and select which to apply.
6. On commit, selected endeavors are created or updated, and parent-child edges are added.

## Markdown Format

The importer uses heading levels to infer hierarchy and type. Here is the expected structure:

```markdown
# Mission

Your mission statement here.

## Aim 1 -- Create Leverage Through Technology

Description of the aim.

### Tactics:
- Tactic one
- Tactic two

### Signals:
- Signal one
- Signal two

### Initiative -- Build Developer Tool Suite
Description of the initiative.

#### Acceptance Criteria:
- Criterion one
- Criterion two
```

Key rules:
- `# Heading` (H1) maps to Mission
- `## Heading` (H2) maps to Aim
- `### Initiative -- Title` (H3 with "Initiative" prefix) maps to Initiative
- Section content under each heading becomes the endeavor description
- `### Tactics:` and `### Signals:` subsections are extracted as structured metadata
- `#### Acceptance Criteria:` under an initiative is included in the initiative's description

## What It Produces

For each parsed section, the importer creates:
- An **endeavor** with the extracted title, description, and inferred node type
- A **`contains` edge** linking it to its parent (based on heading nesting)
- **Provenance metadata** recording the source file, import timestamp, and content hash

## Upsert Behavior

When importing into a graph that already has endeavors, the importer uses similarity matching to decide what to do with each section:

| Similarity Score | Action | Meaning |
|-----------------|--------|---------|
| >= 0.87 | UPDATE | High confidence match -- updates the existing endeavor |
| 0.78 -- 0.87 | REVIEW | Possible match -- flagged for manual review |
| < 0.78 | INSERT | No match found -- creates a new endeavor |

These thresholds are configurable in the import settings UI.

## Limitations

- Requires `OPENAI_API_KEY` for LLM-powered parsing. Without it, import is unavailable.
- Sections that do not match the expected heading patterns (Mission, Aim, Initiative) may be skipped or misclassified.
- Non-strategic content (e.g., "Strengths", "Accomplishments" headings) is recognized but may not map cleanly to endeavor types.
- The importer is designed for the Open Horizons default preset (Mission > Aim > Initiative > Task). Other node type configurations may require manual type correction after import.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/import/markdown-aims` | Generate a preview (dry run) |
| POST | `/api/import/markdown-aims/commit` | Execute the import plan |

Both endpoints currently return HTTP 501 without `OPENAI_API_KEY` configured.

## Example File

See `public/example-aims.md` in the repository for a sample markdown document that demonstrates the expected format.
