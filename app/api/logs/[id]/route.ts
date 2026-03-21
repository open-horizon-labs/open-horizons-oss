import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { queryOne, executeReturning, execute } from '../../../../lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const logId = decodeURIComponent(id)

    const log = await queryOne(
      'SELECT id, entity_type, entity_id, content, content_type, log_date, created_at, updated_at FROM logs WHERE id = $1',
      [logId]
    )

    if (!log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    return NextResponse.json({ log })
  } catch (error) {
    console.error('Get log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const logId = decodeURIComponent(id)
    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const rows = await executeReturning(
      'UPDATE logs SET content = $1 WHERE id = $2 RETURNING id, entity_type, entity_id, content, content_type, log_date, created_at, updated_at',
      [content, logId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    return NextResponse.json({ log: rows[0] })
  } catch (error) {
    console.error('Update log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const logId = decodeURIComponent(id)

    const count = await execute('DELETE FROM logs WHERE id = $1', [logId])

    if (count === 0) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Log deleted' })
  } catch (error) {
    console.error('Delete log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
