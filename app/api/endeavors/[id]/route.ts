import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { query, queryOne, execute } from '../../../../lib/db'

export const dynamic = 'force-dynamic'

function isFullId(id: string): boolean {
  return id.length > 16 || id.includes(':') || id.includes('-')
}

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key', { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const endeavorId = decodeURIComponent(id)

    let endeavor: any

    if (isFullId(endeavorId)) {
      endeavor = await queryOne(
        'SELECT id, title, description, status, context_id, node_type, created_at, updated_at, metadata FROM endeavors WHERE id = $1',
        [endeavorId]
      )
    } else {
      const matches = await query(
        'SELECT id, title, description, status, context_id, node_type, created_at, updated_at, metadata FROM endeavors WHERE id ILIKE $1 LIMIT 2',
        [`${endeavorId}%`]
      )

      if (matches.length > 1) {
        return NextResponse.json({
          error: 'Ambiguous short ID - matches multiple endeavors',
          matches: matches.map(e => ({ id: e.id, title: e.title }))
        }, { status: 400 })
      }

      endeavor = matches[0] || null
    }

    if (!endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    // Compute parent_id from edges
    const parentEdge = await queryOne<{ from_endeavor_id: string }>(
      'SELECT from_endeavor_id FROM edges WHERE to_endeavor_id = $1 AND relationship = $2',
      [endeavor.id, 'contains']
    )

    return NextResponse.json({
      endeavor: {
        ...endeavor,
        parent_id: parentEdge?.from_endeavor_id || null
      }
    })
  } catch (error) {
    console.error('Get endeavor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id } = await context.params
    const endeavorId = decodeURIComponent(id)

    const endeavor = await queryOne<{ id: string; title: string }>(
      'SELECT id, title FROM endeavors WHERE id = $1',
      [endeavorId]
    )

    if (!endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    await execute('DELETE FROM endeavors WHERE id = $1', [endeavorId])

    return NextResponse.json({
      success: true,
      message: `Endeavor "${endeavor.title || endeavorId}" has been permanently deleted`
    })
  } catch (error) {
    console.error('Delete endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
