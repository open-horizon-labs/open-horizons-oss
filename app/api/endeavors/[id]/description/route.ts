import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { execute } from '../../../../../lib/db'

const handleDescriptionUpdate = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id: endeavorId } = await context.params
    const { description } = await request.json()

    const rowCount = await execute(
      'UPDATE endeavors SET description = $1 WHERE id = $2',
      [description, decodeURIComponent(endeavorId)]
    )

    if (rowCount === 0) {
      return Response.json({ error: 'Endeavor not found or not accessible' }, { status: 404 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error in description update:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = handleDescriptionUpdate
export const PATCH = handleDescriptionUpdate
