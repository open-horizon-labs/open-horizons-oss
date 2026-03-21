import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { validateUpdateTitleRequest, validateSuccessResponse, ContractViolationError } from '../../../../../lib/contracts/endeavor-contract'
import { execute } from '../../../../../lib/db'

export const PUT = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id: endeavorId } = await context.params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    let validatedRequest
    try {
      validatedRequest = validateUpdateTitleRequest(body)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        return NextResponse.json({
          error: 'Invalid request',
          details: error.message,
          issues: error.zodError.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
        }, { status: 400 })
      }
      throw error
    }

    const { title } = validatedRequest

    const rowCount = await execute(
      'UPDATE endeavors SET title = $1 WHERE id = $2',
      [title, decodeURIComponent(endeavorId)]
    )

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Endeavor not found or access denied' }, { status: 404 })
    }

    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')

    const response = validateSuccessResponse({ success: true })
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in title update:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
