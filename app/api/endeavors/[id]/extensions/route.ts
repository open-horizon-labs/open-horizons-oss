import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { query } from '../../../../../lib/db'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params

  try {
    const metis = await query(
      'SELECT id, endeavor_id, content, type, created_at, updated_at FROM metis_entries WHERE endeavor_id = $1 ORDER BY created_at DESC',
      [id]
    )

    const guardrails = await query(
      'SELECT id, endeavor_id, content, created_at, updated_at FROM guardrails WHERE endeavor_id = $1 ORDER BY created_at DESC',
      [id]
    )

    return NextResponse.json({ metis, guardrails })
  } catch (error) {
    console.error('Get extensions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
