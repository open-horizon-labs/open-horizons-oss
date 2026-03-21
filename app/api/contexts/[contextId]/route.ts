import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import {
  validateUpdateContextRequest,
  validateUpdateContextResponse,
  UpdateContextRequest,
  UpdateContextResponse,
  ContractViolationError,
  isPersonalContext,
  userOwnsPersonalContext
} from '../../../../lib/contracts/context-contract'

export const PUT = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  params
) => {
  try {
    const { contextId }: { contextId: string } = await params.params
    const requestBody = await request.json()

    console.log('📝 Context update request:', { contextId, userId: user.id, body: requestBody })

    // 🚨 CONTRACT VALIDATION: Validate request format
    let validatedInput: UpdateContextRequest
    try {
      validatedInput = validateUpdateContextRequest(requestBody)
      console.log('✅ Contract validation passed:', validatedInput)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        console.error('🚨 CONTRACT VIOLATION:', error.message)
        return NextResponse.json({
          error: 'Contract violation: Request validation failed',
          details: error.message,
          issues: error.zodError.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            ...(('received' in issue) && { received: issue.received })
          }))
        }, { status: 400 })
      }
      throw error
    }

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Special validation for personal contexts
    if (isPersonalContext(contextId)) {
      if (!userOwnsPersonalContext(contextId, user.id)) {
        console.error('🚨 Personal context ownership violation:', { contextId, userId: user.id })
        return NextResponse.json({
          error: 'Context not found or access denied',
          details: 'Personal contexts can only be updated by their owner'
        }, { status: 404 })
      }
    }

    // Check if context exists and user has access (RLS will handle this automatically)
    const { data: existingContext, error: fetchError } = await supabase
      .from('contexts')
      .select('id, title, description, created_by')
      .eq('id', contextId)
      .single()

    if (fetchError || !existingContext) {
      console.error('🚨 Context not found or no access:', { contextId, userId: user.id, error: fetchError })
      return NextResponse.json({
        error: 'Context not found or access denied',
        details: 'The context does not exist or you do not have permission to update it'
      }, { status: 404 })
    }

    console.log('✅ Found context to update:', existingContext)

    // Update the context
    const { error: updateError } = await supabase
      .from('contexts')
      .update({
        title: validatedInput.title,
        description: validatedInput.description || existingContext.description || ''
      })
      .eq('id', contextId)

    if (updateError) {
      console.error('🚨 Database error updating context:', updateError)
      return NextResponse.json({
        error: 'Failed to update context',
        details: updateError.message
      }, { status: 500 })
    }

    console.log('✅ Successfully updated context:', { contextId, title: validatedInput.title })

    // Revalidate pages that show context data
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')
    revalidatePath('/contexts')

    // 🚨 ENFORCE CONTRACT: API fails if response doesn't match contract
    const responseData = { success: true as const, contextId }
    try {
      const validatedResponse = validateUpdateContextResponse(responseData)
      console.log('✅ Response contract validation passed')
      return NextResponse.json(validatedResponse)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        console.error('🚨 RESPONSE CONTRACT VIOLATION:', error.message)
        return NextResponse.json({
          error: 'Internal contract violation: Response format invalid',
          details: error.message
        }, { status: 500 })
      }
      throw error
    }

  } catch (error: any) {
    if (error?.name === 'ZodError') {
      console.error('🚨 Validation Error:', error.issues)
      return NextResponse.json({
        error: 'Invalid request format',
        issues: error.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
          ...(('received' in issue) && { received: issue.received })
        }))
      }, { status: 400 })
    }

    console.error('🚨 Unexpected error in context update:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
})

export const PATCH = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  params
) => {
  try {
    const { contextId }: { contextId: string } = await params.params

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)
    const body = await request.json()

    // Check if this is an archive operation
    if (body.action === 'archive') {
      // Load the context to check permissions
      const { data: context, error: loadError } = await supabase
        .from('contexts')
        .select('created_by')
        .eq('id', contextId)
        .single()

      if (loadError || !context) {
        return NextResponse.json({ error: 'Context not found' }, { status: 404 })
      }

      // Check permissions - only owner can archive context
      if (context.created_by !== user.id) {
        return NextResponse.json({ error: 'Only context owners can archive contexts' }, { status: 403 })
      }

      // Archive the context
      const { error } = await supabase
        .from('contexts')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', contextId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error updating context:', error)
    return NextResponse.json(
      { error: 'Failed to update context' },
      { status: 500 }
    )
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

    console.log('🗑️ Context delete request:', { contextId, userId: user.id })

    // 🚨 PROTECT PERSONAL CONTEXTS: Prevent deletion of personal contexts
    if (isPersonalContext(contextId)) {
      console.error('🚨 Attempted deletion of personal context:', { contextId, userId: user.id })
      return NextResponse.json({
        error: 'Personal contexts cannot be deleted',
        details: 'Personal contexts are protected and cannot be deleted. You can rename them instead.'
      }, { status: 403 })
    }

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Load the context
    const { data: context, error: loadError } = await supabase
      .from('contexts')
      .select('created_by')
      .eq('id', contextId)
      .single()

    if (loadError || !context) {
      return NextResponse.json({
        error: 'Context not found',
        details: 'The context does not exist or you do not have permission to delete it'
      }, { status: 404 })
    }

    // Check permissions - only owner can delete context
    if (context.created_by !== user.id) {
      return NextResponse.json({
        error: 'Only context owners can delete contexts',
        details: 'You can only delete contexts that you created'
      }, { status: 403 })
    }

    // Delete the context
    const { error } = await supabase
      .from('contexts')
      .delete()
      .eq('id', contextId)

    if (error) {
      console.error('🚨 Database error deleting context:', error)

      // Handle specific database errors with appropriate status codes
      if (error.code === 'PGRST116' || error.message?.includes('policy')) {
        // RLS policy violation
        return NextResponse.json({
          error: 'Access denied: You do not have permission to delete this context',
          details: error.message
        }, { status: 403 })
      }

      if (error.code === '23503' || error.message?.includes('foreign key')) {
        // Foreign key constraint - context has dependent records
        return NextResponse.json({
          error: 'Cannot delete context: it contains endeavors or other data',
          details: 'Please move or delete all content from this context before deleting it'
        }, { status: 409 })
      }

      // Generic database error
      return NextResponse.json({
        error: 'Failed to delete context',
        details: error.message
      }, { status: 500 })
    }

    console.log('✅ Successfully deleted context:', { contextId })

    // Revalidate pages that show context data
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')
    revalidatePath('/contexts')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('🚨 Unexpected error deleting context:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete context',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})