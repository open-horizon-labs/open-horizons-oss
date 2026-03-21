import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import {
  validateUpdateContextRequest,
  validateUpdateContextResponse,
  ContractViolationError,
} from '../../../../lib/contracts/context-contract'
import { queryOne, execute } from '../../../../lib/db'

export const PUT = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  params
) => {
  try {
    const { contextId }: { contextId: string } = await params.params
    const requestBody = await request.json()

    let validatedInput
    try {
      validatedInput = validateUpdateContextRequest(requestBody)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        return NextResponse.json({
          error: 'Contract violation: Request validation failed',
          details: error.message,
          issues: error.zodError.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          }))
        }, { status: 400 })
      }
      throw error
    }

    const existingContext = await queryOne(
      'SELECT id, title, description FROM contexts WHERE id = $1',
      [contextId]
    )

    if (!existingContext) {
      return NextResponse.json({
        error: 'Context not found or access denied',
      }, { status: 404 })
    }

    await execute(
      'UPDATE contexts SET title = $1, description = $2 WHERE id = $3',
      [validatedInput.title, validatedInput.description || existingContext.description || '', contextId]
    )

    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')

    const responseData = { success: true as const, contextId }
    try {
      const validatedResponse = validateUpdateContextResponse(responseData)
      return NextResponse.json(validatedResponse)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        return NextResponse.json({
          error: 'Internal contract violation: Response format invalid',
          details: error.message
        }, { status: 500 })
      }
      throw error
    }
  } catch (error: any) {
    console.error('Unexpected error in context update:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
})

export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  params
) => {
  try {
    const { contextId }: { contextId: string } = await params.params

    const context = await queryOne('SELECT id FROM contexts WHERE id = $1', [contextId])
    if (!context) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    try {
      await execute('DELETE FROM contexts WHERE id = $1', [contextId])
    } catch (error: any) {
      if (error?.code === '23503') {
        return NextResponse.json({
          error: 'Cannot delete context: it contains endeavors or other data',
          details: 'Please move or delete all content from this context before deleting it'
        }, { status: 409 })
      }
      throw error
    }

    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error deleting context:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete context',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})
