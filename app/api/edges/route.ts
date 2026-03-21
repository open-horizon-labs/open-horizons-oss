import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { query, queryOne, executeReturning } from '../../../lib/db'

export const dynamic = 'force-dynamic'

interface CreateEdgeRequest {
  fromEndeavorId: string
  toEndeavorId: string
  relationship: string
  weight?: number
  context?: string
  metadata?: Record<string, unknown>
}

export const POST = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod
) => {
  try {
    const body = await req.json() as CreateEdgeRequest
    const { fromEndeavorId, toEndeavorId, relationship, weight, context, metadata } = body

    if (!fromEndeavorId || !toEndeavorId || !relationship) {
      return NextResponse.json(
        { error: 'fromEndeavorId, toEndeavorId, and relationship are required' },
        { status: 400 }
      )
    }

    if (fromEndeavorId === toEndeavorId) {
      return NextResponse.json(
        { error: 'Cannot create edge to self' },
        { status: 400 }
      )
    }

    // Verify both endeavors exist
    const fromEndeavor = await queryOne('SELECT id FROM endeavors WHERE id = $1', [fromEndeavorId])
    if (!fromEndeavor) {
      return NextResponse.json({ error: 'From endeavor not found or not accessible' }, { status: 404 })
    }

    const toEndeavor = await queryOne('SELECT id FROM endeavors WHERE id = $1', [toEndeavorId])
    if (!toEndeavor) {
      return NextResponse.json({ error: 'To endeavor not found or not accessible' }, { status: 404 })
    }

    try {
      const rows = await executeReturning(
        `INSERT INTO edges (from_endeavor_id, to_endeavor_id, relationship, weight, context, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [fromEndeavorId, toEndeavorId, relationship, weight ?? 1.0, context ?? null, JSON.stringify(metadata ?? {})]
      )

      return NextResponse.json({ edge: rows[0] }, { status: 201 })
    } catch (error: any) {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'Edge already exists' }, { status: 409 })
      }
      throw error
    }
  } catch (error) {
    console.error('Edge creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const GET = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod
) => {
  try {
    const { searchParams } = new URL(req.url)
    const endeavorId = searchParams.get('endeavorId')
    const relationship = searchParams.get('relationship')
    const direction = searchParams.get('direction')

    if (!endeavorId) {
      return NextResponse.json(
        { error: 'endeavorId query parameter is required' },
        { status: 400 }
      )
    }

    let sql = 'SELECT * FROM edges WHERE '
    const params: any[] = []
    let paramIdx = 1

    if (direction === 'incoming') {
      sql += `to_endeavor_id = $${paramIdx++}`
      params.push(endeavorId)
    } else if (direction === 'outgoing') {
      sql += `from_endeavor_id = $${paramIdx++}`
      params.push(endeavorId)
    } else {
      sql += `(from_endeavor_id = $${paramIdx++} OR to_endeavor_id = $${paramIdx++})`
      params.push(endeavorId, endeavorId)
    }

    if (relationship) {
      sql += ` AND relationship = $${paramIdx++}`
      params.push(relationship)
    }

    sql += ' ORDER BY created_at DESC'

    const edges = await query(sql, params)

    return NextResponse.json({ edges })
  } catch (error) {
    console.error('Edge query error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
