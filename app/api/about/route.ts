/**
 * GET /api/about
 *
 * Public endpoint that returns information about Open Horizons, including
 * the live create-time endeavor contract and valid node type slugs.
 */

import { getActiveConfig, rowsToConfig, type StrategyConfig } from '../../../lib/config'
import { query } from '../../../lib/db'

function isMissingNodeTypesRelation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === '42P01'
  )
}

async function getAboutConfig(): Promise<StrategyConfig> {
  try {
    const rows = await query(
      'SELECT slug, name, description, icon, color, chip_classes, valid_children, valid_parents, sort_order FROM node_types ORDER BY sort_order ASC'
    )

    if (rows.length > 0) {
      return rowsToConfig(rows)
    }
  } catch (error) {
    if (!isMissingNodeTypesRelation(error)) {
      throw error
    }
  }

  return getActiveConfig()
}

async function buildAboutInfo() {
  const config = await getAboutConfig()
  const hierarchy = config.nodeTypes.map((nt, i) => ({
    level: i + 1,
    type: nt.name,
    slug: nt.slug,
    description: nt.description,
    validChildren: nt.validChildren,
  }))

  return {
    name: 'Open Horizons',
    version: '0.1.1',
    description: 'A self-hostable strategy graph for aligning work to organizational strategy.',
    strategyPreset: config.name,

    coreModel: {
      hierarchy,
      principle: 'Every node traces back to a mission, so you always know *why*',
    },

    concepts: {
      contexts: 'Spaces where endeavors live',
      endeavors: 'Any node in the hierarchy',
      alignment: 'The thread connecting daily work to strategic purpose',
    },

    apiEndpoints: {
      contexts: {
        list: 'GET /api/contexts',
        get: 'GET /api/contexts/:contextId',
      },
      endeavors: {
        dashboard: 'GET /api/dashboard?contextId=:contextId',
        get: 'GET /api/endeavors/:id',
        create: {
          method: 'POST',
          path: '/api/endeavors/create',
          discoverability: 'GET /api/about',
          request: {
            requiredFields: ['title', 'type'],
            optionalFields: ['description', 'contextId', 'parentId'],
            unknownFieldsRejected: true,
            validTypeSlugs: hierarchy.map((nodeType) => nodeType.slug),
          },
          response: {
            fields: ['success', 'endeavorId'],
          },
        },
      },
      mcp: {
        endpoint: 'POST /api/mcp',
        methods: ['list_endeavors', 'get_endeavor', 'get_tree', 'search_endeavors'],
      },
    },
  }
}

async function buildAboutMarkdown() {
  const info = await buildAboutInfo()
  const tree = info.coreModel.hierarchy.map((nodeType, index) => {
    const indent = '  '.repeat(index)
    const arrow = index > 0 ? '└── ' : ''
    return `${indent}${arrow}${nodeType.type} (${nodeType.description})`
  }).join('\n')

  return `# Open Horizons

A self-hostable strategy graph for aligning work to organizational strategy.

## Active Preset: ${info.strategyPreset}

\`\`\`
${tree}
\`\`\`

## Create Endeavor Contract

- Endpoint: \`${info.apiEndpoints.endeavors.create.method} ${info.apiEndpoints.endeavors.create.path}\`
- Required fields: \`${info.apiEndpoints.endeavors.create.request.requiredFields.join('`, `')}\`
- Optional fields: \`${info.apiEndpoints.endeavors.create.request.optionalFields.join('`, `')}\`
- Unknown fields are rejected
- Valid type slugs: \`${info.apiEndpoints.endeavors.create.request.validTypeSlugs.join('`, `')}\`

## API Endpoints

- \`GET /api/about\` - Live create contract and type vocabulary
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
    return new Response(await buildAboutMarkdown(), {
      headers: { 'Content-Type': 'text/markdown' },
    })
  }

  return Response.json(await buildAboutInfo())
}
