/**
 * GET /api/about
 *
 * Public endpoint that returns information about Open Horizons.
 * Useful for API consumers and AI agents to understand the system.
 */

const ABOUT_INFO = {
  name: 'Open Horizons',
  version: '0.1.0',
  description: 'An AI-native strategic alignment system that connects high-level intent to daily execution.',

  coreModel: {
    hierarchy: [
      { level: 1, type: 'Mission', description: 'Why you exist - your fundamental purpose' },
      { level: 2, type: 'Aim', description: 'Outcome you want - specific goals to achieve' },
      { level: 3, type: 'Initiative', description: 'How you\'ll achieve it - strategies and approaches' },
      { level: 4, type: 'Task', description: 'What you do today - concrete actions' }
    ],
    principle: 'Every task traces back to a mission, so you always know *why*'
  },

  concepts: {
    contexts: 'Spaces where endeavors live',
    endeavors: 'Any node in the hierarchy (mission, aim, initiative, task)',
    alignment: 'The thread connecting daily work to strategic purpose'
  },

  apiEndpoints: {
    contexts: {
      list: 'GET /api/contexts',
      get: 'GET /api/contexts/:contextId'
    },
    endeavors: {
      dashboard: 'GET /api/dashboard?contextId=:contextId',
      get: 'GET /api/endeavors/:id',
      create: 'POST /api/endeavors/create'
    }
  },

  bestPractices: [
    'Always trace tasks back to their parent mission to understand *why*',
    'Use contexts to separate different domains of work',
    'Structure your hierarchy so every task traces to a mission'
  ]
}

const ABOUT_MARKDOWN = `# Open Horizons

Open Horizons is an AI-native strategic alignment system that connects high-level intent to daily execution.

## Core Model

\`\`\`
Mission (why you exist)
  └── Aim (outcome you want)
       └── Initiative (how you'll achieve it)
            └── Task (what you do today)
\`\`\`

## Key Concepts

- **Contexts**: Spaces where endeavors live
- **Endeavors**: Any node in the hierarchy (mission, aim, initiative, task)
- **Alignment**: Every task traces back to a mission, so you always know *why*

## API Endpoints

### Contexts
- \`GET /api/contexts\` - List all contexts
- \`GET /api/contexts/:contextId\` - Get context details

### Endeavors
- \`GET /api/dashboard?contextId=:contextId\` - Get endeavor hierarchy for a context
- \`GET /api/endeavors/:id\` - Get endeavor details
- \`POST /api/endeavors/create\` - Create a new endeavor

## Best Practices

- Always trace tasks back to their parent mission to understand *why*
- Use contexts to separate different domains of work
- Structure your hierarchy so every task traces to a mission
`

export async function GET(request: Request) {
  const url = new URL(request.url)
  const format = url.searchParams.get('format')

  if (format === 'markdown' || format === 'md') {
    return new Response(ABOUT_MARKDOWN, {
      headers: { 'Content-Type': 'text/markdown' }
    })
  }

  return Response.json(ABOUT_INFO)
}
