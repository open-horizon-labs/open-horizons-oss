/**
 * GET /api/about
 *
 * Public endpoint that returns information about Open Horizons.
 * Derives hierarchy from the active strategy configuration.
 */

import { getActiveConfig } from '../../../lib/config'

function buildAboutInfo() {
  const config = getActiveConfig()

  return {
    name: 'Open Horizons',
    version: '0.1.0',
    description: 'A self-hostable strategy graph for aligning work to organizational strategy.',
    strategyPreset: config.name,

    coreModel: {
      hierarchy: config.nodeTypes.map((nt, i) => ({
        level: i + 1,
        type: nt.name,
        slug: nt.slug,
        description: nt.description,
        validChildren: nt.validChildren
      })),
      principle: 'Every node traces back to a mission, so you always know *why*'
    },

    concepts: {
      contexts: 'Spaces where endeavors live',
      endeavors: 'Any node in the hierarchy',
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
      },
      mcp: {
        endpoint: 'POST /api/mcp',
        methods: ['list_endeavors', 'get_endeavor', 'get_tree', 'search_endeavors']
      }
    }
  }
}

function buildAboutMarkdown() {
  const config = getActiveConfig()
  const tree = config.nodeTypes.map((nt, i) => {
    const indent = '  '.repeat(i)
    const arrow = i > 0 ? '└── ' : ''
    return `${indent}${arrow}${nt.name} (${nt.description})`
  }).join('\n')

  return `# Open Horizons

A self-hostable strategy graph for aligning work to organizational strategy.

## Active Preset: ${config.name}

\`\`\`
${tree}
\`\`\`

## API Endpoints

- \`GET /api/contexts\` - List all contexts
- \`GET /api/dashboard?contextId=:contextId\` - Get endeavor hierarchy
- \`GET /api/endeavors/:id\` - Get endeavor details
- \`POST /api/endeavors/create\` - Create a new endeavor
- \`POST /api/mcp\` - JSON-RPC endpoint for AI agents
`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const format = url.searchParams.get('format')

  if (format === 'markdown' || format === 'md') {
    return new Response(buildAboutMarkdown(), {
      headers: { 'Content-Type': 'text/markdown' }
    })
  }

  return Response.json(buildAboutInfo())
}
