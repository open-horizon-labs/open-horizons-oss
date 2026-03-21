import { NextRequest, NextResponse } from 'next/server'
import { query, execute, getClient } from '../../../../lib/db'
import { invalidateNodeTypeCache } from '../../../../lib/config'

export const dynamic = 'force-dynamic'

// POST /api/node-types/load-preset — replace all node types with a preset
export async function POST(request: NextRequest) {
  const client = await getClient()
  try {
    const { nodeTypes } = await request.json()

    if (!Array.isArray(nodeTypes) || nodeTypes.length === 0) {
      return NextResponse.json({ error: 'nodeTypes array is required' }, { status: 400 })
    }

    await client.query('BEGIN')

    // Delete all existing node types that aren't used by endeavors
    // For types that ARE used, update them in place
    const usedTypes = await client.query(
      'SELECT DISTINCT LOWER(node_type) as slug FROM endeavors'
    )
    const usedSlugs = new Set(usedTypes.rows.map((r: any) => r.slug))
    const newSlugs = new Set(nodeTypes.map((nt: any) => nt.slug))

    // Delete types not in the new preset AND not used by endeavors
    await client.query(
      'DELETE FROM node_types WHERE slug NOT IN (SELECT unnest($1::text[]))',
      [nodeTypes.map((nt: any) => nt.slug)]
    )

    // Upsert all new types
    for (const nt of nodeTypes) {
      await client.query(
        `INSERT INTO node_types (slug, name, description, icon, color, chip_classes, valid_children, valid_parents, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           icon = EXCLUDED.icon,
           color = EXCLUDED.color,
           chip_classes = EXCLUDED.chip_classes,
           valid_children = EXCLUDED.valid_children,
           valid_parents = EXCLUDED.valid_parents,
           sort_order = EXCLUDED.sort_order`,
        [
          nt.slug, nt.name, nt.description || '',
          nt.icon || '📄', nt.color || '#6b7280',
          nt.chip_classes || 'bg-gray-100 text-gray-800 border-gray-200',
          nt.valid_children || [], nt.valid_parents || [],
          nt.sort_order ?? 0
        ]
      )
    }

    await client.query('COMMIT')
    invalidateNodeTypeCache()

    return NextResponse.json({ success: true, count: nodeTypes.length })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to load preset:', error)
    return NextResponse.json({ error: 'Failed to load preset' }, { status: 500 })
  } finally {
    client.release()
  }
}
