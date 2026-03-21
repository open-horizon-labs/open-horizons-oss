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
  const { id } = await params

  try {
    const candidate = await queryOne(
      'SELECT id, status FROM candidates WHERE id = $1',
      [id]
    )

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (candidate.status !== 'pending') {
      return NextResponse.json({ error: `Candidate is already ${candidate.status}` }, { status: 400 })
    }

    const rows = await executeReturning(
      "UPDATE candidates SET status = 'rejected' WHERE id = $1 RETURNING id, endeavor_id, type, content, status, promoted_to_id, created_at, updated_at",
      [id]
    )

    return NextResponse.json({ success: true, candidate: rows[0] })
  } catch (error) {
    console.error('Reject candidate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
