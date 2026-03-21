import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { validateUpdateTitleRequest, validateSuccessResponse, ContractViolationError } from '../../../../../lib/contracts/endeavor-contract'

export const PUT = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id: endeavorId } = await context.params

    // Parse and validate request body
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

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Update the endeavor title
    const { data: updateResult, error } = await supabase
      .from('endeavors')
      .update({
        title,
        updated_at: new Date().toISOString()
      })
      .eq('id', decodeURIComponent(endeavorId))
      .eq('created_by', user.id)
      .select('id')

    if (error) {
      console.error('Error updating title:', error)
      return NextResponse.json({ error: 'Failed to update title' }, { status: 500 })
    }

    // Check if any row was actually updated
    if (!updateResult || updateResult.length === 0) {
      return NextResponse.json({ error: 'Endeavor not found or access denied' }, { status: 404 })
    }

    // Revalidate pages that show endeavor data
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')
    revalidatePath('/endeavors', 'layout') // Revalidate all endeavor pages
    revalidatePath('/daily', 'layout') // Revalidate all daily pages

    const response = validateSuccessResponse({ success: true })
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in title update:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
