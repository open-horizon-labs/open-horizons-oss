import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { queryOne, executeReturning } from '../../../../../lib/db'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const endeavorId = decodeURIComponent(id)

    const body = await request.json().catch(() => ({}))
    const reason = body.reason || null

    const endeavor = await queryOne<{ id: string; title: string; metadata: any }>(
      'SELECT id, title, metadata FROM endeavors WHERE id = $1',
      [endeavorId]
    )

    if (!endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    const metadata = endeavor.metadata || {}
    if (reason) {
      metadata.archivedReason = reason
    }

    const rows = await executeReturning(
      'UPDATE endeavors SET status = $1, metadata = $2 WHERE id = $3 RETURNING id, status, updated_at',
      ['archived', JSON.stringify(metadata), endeavorId]
    )

    return NextResponse.json({
      success: true,
      message: `Endeavor "${endeavor.title || endeavorId}" has been archived`,
      archived_at: rows[0].updated_at
    })
  } catch (error) {
    console.error('Archive endeavor error:', error)
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
    const endeavorId = decodeURIComponent(id)

    const endeavor = await queryOne<{ id: string; title: string; metadata: any }>(
      'SELECT id, title, metadata FROM endeavors WHERE id = $1',
      [endeavorId]
    )

    if (!endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    const metadata = endeavor.metadata || {}
    delete metadata.archivedReason

    await executeReturning(
      'UPDATE endeavors SET status = $1, metadata = $2 WHERE id = $3 RETURNING id',
      ['active', JSON.stringify(metadata), endeavorId]
    )

    return NextResponse.json({
      success: true,
      message: `Endeavor "${endeavor.title || endeavorId}" has been restored`
    })
  } catch (error) {
    console.error('Unarchive endeavor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
