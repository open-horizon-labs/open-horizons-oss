import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { query } from '../../../../lib/db'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('include_archived') === 'true'

    const endeavors = includeArchived
      ? await query(
          'SELECT id, title, description, status, context_id, node_type, created_at, updated_at, metadata FROM endeavors WHERE context_id = $1 ORDER BY created_at DESC',
          ['default']
        )
      : await query(
          'SELECT id, title, description, status, context_id, node_type, created_at, updated_at, metadata FROM endeavors WHERE context_id = $1 AND status != $2 ORDER BY created_at DESC',
          ['default', 'archived']
        )

    const endeavorIds = endeavors.map(e => e.id)
    let edges: any[] = []
    if (endeavorIds.length > 0) {
      edges = await query(
        'SELECT from_endeavor_id, to_endeavor_id FROM edges WHERE relationship = $1 AND to_endeavor_id = ANY($2)',
        ['contains', endeavorIds]
      )
    }

    const parentMap = new Map<string, string>()
    for (const edge of edges) {
      parentMap.set(edge.to_endeavor_id, edge.from_endeavor_id)
    }

    const nodes = endeavors.map((endeavor: any) => ({
      id: endeavor.id,
      node_type: endeavor.node_type,
      parent_id: parentMap.get(endeavor.id) || null,
      title: endeavor.title,
      description: endeavor.description || '',
      status: endeavor.status,
      metadata: endeavor.metadata || {},
      created_at: endeavor.created_at,
      archived_at: null
    }))

    return NextResponse.json({ nodes })
  } catch (error) {
    console.error('Personal endeavors error:', error)
    return NextResponse.json({ nodes: [] })
  }
})
