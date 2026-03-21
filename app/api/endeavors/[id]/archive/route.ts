import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { validateArchiveRequest, validateSuccessResponse, ContractViolationError } from '../../../../../lib/contracts/endeavor-contract'

export const dynamic = 'force-dynamic'

// Archive an endeavor
export const POST = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id } = await context.params
    const endeavorId = decodeURIComponent(id)

    // Parse and validate request body
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    let validatedRequest
    try {
      validatedRequest = validateArchiveRequest(body)
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
    const { reason } = validatedRequest

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Verify endeavor exists and belongs to user
    const { data: endeavor, error: fetchError } = await supabase
      .from('endeavors')
      .select('id, title')
      .eq('id', endeavorId)
      .eq('created_by', user.id)
      .single()

    if (fetchError || !endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    // Archive the endeavor
    const { error: archiveError } = await supabase
      .from('endeavors')
      .update({
        archived_at: new Date().toISOString(),
        archived_reason: reason || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', endeavorId)
      .eq('created_by', user.id)

    if (archiveError) {
      console.error('Failed to archive endeavor:', archiveError)
      return NextResponse.json({ error: 'Failed to archive endeavor' }, { status: 500 })
    }

    // Revalidate pages that show endeavor data
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')
    revalidatePath('/endeavors', 'layout') // Revalidate all endeavor pages
    revalidatePath('/daily', 'layout') // Revalidate all daily pages

    const response = validateSuccessResponse({
      success: true,
      message: `Endeavor "${endeavor.title || endeavorId}" has been archived`
    })
    return NextResponse.json(response)

  } catch (error) {
    console.error('Archive endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// Unarchive an endeavor
export const DELETE = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id } = await context.params
    const endeavorId = decodeURIComponent(id)

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Verify endeavor exists and belongs to user
    const { data: endeavor, error: fetchError } = await supabase
      .from('endeavors')
      .select('id, title')
      .eq('id', endeavorId)
      .eq('created_by', user.id)
      .single()

    if (fetchError || !endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    // Unarchive the endeavor
    const { error: unarchiveError } = await supabase
      .from('endeavors')
      .update({
        archived_at: null,
        archived_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', endeavorId)
      .eq('created_by', user.id)

    if (unarchiveError) {
      console.error('Failed to unarchive endeavor:', unarchiveError)
      return NextResponse.json({ error: 'Failed to unarchive endeavor' }, { status: 500 })
    }

    // Revalidate pages that show endeavor data
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')
    revalidatePath('/endeavors', 'layout') // Revalidate all endeavor pages
    revalidatePath('/daily', 'layout') // Revalidate all daily pages

    const response = validateSuccessResponse({
      success: true,
      message: `Endeavor "${endeavor.title || endeavorId}" has been unarchived`
    })
    return NextResponse.json(response)

  } catch (error) {
    console.error('Unarchive endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
