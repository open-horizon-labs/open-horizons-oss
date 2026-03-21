import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { query, executeReturning } from '../../../lib/db'

export const dynamic = 'force-dynamic'

export const GET = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    let sql = 'SELECT id, entity_type, entity_id, content, content_type, log_date, created_at, updated_at FROM logs WHERE 1=1'
    const params: any[] = []
    let idx = 1

    if (entityType) {
      sql += ` AND entity_type = $${idx++}`
      params.push(entityType)
    }

    if (entityId) {
      sql += ` AND entity_id = $${idx++}`
      params.push(entityId)
    }

    if (startDate) {
      sql += ` AND log_date >= $${idx++}`
      params.push(startDate)
    }

    if (endDate) {
      sql += ` AND log_date <= $${idx++}`
      params.push(endDate)
    }

    sql += ' ORDER BY log_date DESC, created_at DESC'

    const rows = await query(sql, params)
    return NextResponse.json({ logs: rows })
  } catch (error) {
    console.error('List logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json()
    const { entity_type, entity_id, content, content_type, log_date } = body

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    if (!entity_id) {
      return NextResponse.json({ error: 'entity_id is required' }, { status: 400 })
    }

    const rows = await executeReturning(
      'INSERT INTO logs (entity_type, entity_id, content, content_type, log_date) VALUES ($1, $2, $3, $4, $5) RETURNING id, entity_type, entity_id, content, content_type, log_date, created_at, updated_at',
      [
        entity_type || 'endeavor',
        entity_id,
        content,
        content_type || 'markdown',
        log_date || new Date().toISOString().split('T')[0]
      ]
    )

    return NextResponse.json({ log: rows[0] }, { status: 201 })
  } catch (error) {
    console.error('Create log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
