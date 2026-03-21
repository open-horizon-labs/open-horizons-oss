import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { queryOne, execute } from '../../../../lib/db'

export const dynamic = 'force-dynamic'

export const DELETE = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id } = await context.params
    const edgeId = decodeURIComponent(id)

    const edge = await queryOne('SELECT id FROM edges WHERE id = $1', [edgeId])
    if (!edge) {
      return NextResponse.json({ error: 'Edge not found' }, { status: 404 })
    }

    await execute('DELETE FROM edges WHERE id = $1', [edgeId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Edge deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
