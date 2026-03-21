import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { query, executeReturning } from '../../../lib/db'

export const dynamic = 'force-dynamic'

export const GET = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const endeavorId = searchParams.get('endeavor_id')

    let sql = 'SELECT id, endeavor_id, content, type, created_at, updated_at FROM metis_entries'
    const params: any[] = []

    if (endeavorId) {
      sql += ' WHERE endeavor_id = $1'
      params.push(endeavorId)
    }

    sql += ' ORDER BY created_at DESC'

    const rows = await query(sql, params)
    return NextResponse.json({ metis: rows })
  } catch (error) {
    console.error('List metis error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json()
    const { endeavor_id, content, type } = body

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const rows = await executeReturning(
      'INSERT INTO metis_entries (endeavor_id, content, type) VALUES ($1, $2, $3) RETURNING id, endeavor_id, content, type, created_at, updated_at',
      [endeavor_id || null, content, type || 'pattern']
    )

    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    console.error('Create metis error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
