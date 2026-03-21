import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { query, executeReturning } from '../../../lib/db'

export const dynamic = 'force-dynamic'

export const GET = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const endeavorId = searchParams.get('endeavor_id')
    const status = searchParams.get('status')

    let sql = 'SELECT id, endeavor_id, type, content, status, promoted_to_id, created_at, updated_at FROM candidates WHERE 1=1'
    const params: any[] = []
    let idx = 1

    if (endeavorId) {
      sql += ` AND endeavor_id = $${idx++}`
      params.push(endeavorId)
    }

    if (status) {
      sql += ` AND status = $${idx++}`
      params.push(status)
    }

    sql += ' ORDER BY created_at DESC'

    const rows = await query(sql, params)
    return NextResponse.json({ candidates: rows })
  } catch (error) {
    console.error('List candidates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json()
    const { endeavor_id, type, content } = body

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const rows = await executeReturning(
      'INSERT INTO candidates (endeavor_id, type, content) VALUES ($1, $2, $3) RETURNING id, endeavor_id, type, content, status, promoted_to_id, created_at, updated_at',
      [endeavor_id || null, type || 'metis', content]
    )

    const candidate = rows[0]
    return NextResponse.json({ ...candidate, candidate_id: candidate.id }, { status: 201 })
  } catch (error) {
    console.error('Create candidate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
