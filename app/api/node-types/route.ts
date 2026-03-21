import { NextRequest, NextResponse } from 'next/server'
import { query, execute } from '../../../lib/db'

export const dynamic = 'force-dynamic'

// GET /api/node-types — list all node types ordered by sort_order
export async function GET() {
  try {
    const rows = await query(
      'SELECT slug, name, description, icon, color, chip_classes, valid_children, valid_parents, sort_order FROM node_types ORDER BY sort_order ASC'
    )
    return NextResponse.json({ nodeTypes: rows })
  } catch (error) {
    console.error('Failed to load node types:', error)
    return NextResponse.json({ error: 'Failed to load node types' }, { status: 500 })
  }
}

// POST /api/node-types — create or update a node type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, name, description, icon, color, chip_classes, valid_children, valid_parents, sort_order } = body

    if (!slug || !name) {
      return NextResponse.json({ error: 'slug and name are required' }, { status: 400 })
    }

    await execute(
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
        slug,
        name,
        description || '',
        icon || '📄',
        color || '#6b7280',
        chip_classes || 'bg-gray-100 text-gray-800 border-gray-200',
        valid_children || [],
        valid_parents || [],
        sort_order ?? 0
      ]
    )

    // Invalidate the cache
    const { invalidateNodeTypeCache } = await import('../../../lib/config')
    invalidateNodeTypeCache()

    return NextResponse.json({ success: true, slug })
  } catch (error) {
    console.error('Failed to save node type:', error)
    return NextResponse.json({ error: 'Failed to save node type' }, { status: 500 })
  }
}

// DELETE /api/node-types — delete a node type by slug (body: { slug })
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug } = body

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    // Check if any endeavors use this type
    const endeavors = await query(
      'SELECT COUNT(*) as count FROM endeavors WHERE LOWER(node_type) = LOWER($1)',
      [slug]
    )
    if (endeavors[0]?.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${endeavors[0].count} endeavors use this type` },
        { status: 409 }
      )
    }

    await execute('DELETE FROM node_types WHERE slug = $1', [slug])

    const { invalidateNodeTypeCache } = await import('../../../lib/config')
    invalidateNodeTypeCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete node type:', error)
    return NextResponse.json({ error: 'Failed to delete node type' }, { status: 500 })
  }
}
