import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import {
  validateCreateEndeavorRequestWithContext,
  validateCreateEndeavorResponse,
  transformToDatabase,
  CreateEndeavorRequest,
  CreateEndeavorResponse,
  ContractViolationError
} from '../../../../lib/contracts/endeavor-contract'
import { validateAndResolveContext } from '../../../../lib/api/context-validation'

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    const requestBody = await request.json()
    console.log('📍 Raw request data:', requestBody, 'User ID:', user.id)

    // 🚨 ENHANCED CONTRACT VALIDATION: Catches context ID mismatches at contract level
    let validatedInput: CreateEndeavorRequest
    try {
      validatedInput = validateCreateEndeavorRequestWithContext(requestBody, user.id)
      console.log('✅ Enhanced contract validation passed:', validatedInput)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        console.error('🚨 CONTRACT VIOLATION (with context check):', error.message)
        return Response.json({
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

    // Determine effective contextId - inherit from parent if not explicitly provided
    let effectiveContextId = validatedInput.contextId
    let parentEndeavor: { id: string; context_id: string; created_by: string } | null = null

    // If parent specified, look it up first to potentially inherit context
    if (validatedInput.parentId) {
      const { data, error: parentError } = await supabase
        .from('endeavors')
        .select('id, context_id, created_by')
        .eq('id', validatedInput.parentId)
        .single()

      if (parentError || !data) {
        return Response.json({ error: 'Parent not found or not accessible' }, { status: 400 })
      }
      parentEndeavor = data

      // If no explicit contextId provided, inherit from parent
      if (!effectiveContextId) {
        effectiveContextId = parentEndeavor.context_id
        console.log('📍 Inheriting context from parent:', {
          parentId: validatedInput.parentId,
          inheritedContextId: effectiveContextId
        })
      }
    }

    // 🚨 COMPREHENSIVE CONTEXT VALIDATION: Prevents FK violations before DB insert
    const contextValidation = await validateAndResolveContext(effectiveContextId, user.id, supabase)
    if (!contextValidation.success) {
      console.error('🚨 CONTEXT VALIDATION FAILED:', contextValidation.error)
      return Response.json({
        error: 'Context validation failed',
        details: contextValidation.error
      }, { status: 400 })
    }

    const resolvedContextId = contextValidation.contextId
    console.log('✅ Context validated and resolved:', {
      inputContextId: validatedInput.contextId,
      effectiveContextId,
      userId: user.id,
      resolvedContextId
    })

    // If parent exists, verify it's in the resolved context (handles case where explicit contextId differs)
    if (parentEndeavor && parentEndeavor.context_id !== resolvedContextId) {
      return Response.json({ error: 'Parent not available in target context' }, { status: 400 })
    }

    // 🚨 USE CONTRACT TRANSFORMATION: Single source of truth
    const dbRecord = transformToDatabase(validatedInput, user.id, resolvedContextId)
    console.log('📍 Creating endeavor with contract transformation:', dbRecord)

    const { error: endeavorError } = await supabase
      .from('endeavors')
      .insert(dbRecord)

    if (endeavorError) {
      console.error('Error creating endeavor:', endeavorError)
      return Response.json({ error: `Failed to create endeavor: ${endeavorError.message}` }, { status: 500 })
    }

    // Create parent edge if parent specified (unified graph model)
    if (validatedInput.parentId) {
      const { error: edgeError } = await supabase
        .from('edges')
        .insert({
          from_endeavor_id: validatedInput.parentId,
          to_endeavor_id: dbRecord.id,
          relationship: 'contains',
          created_by: user.id
        })

      if (edgeError) {
        console.error('Error creating parent edge:', edgeError)
        // Clean up the endeavor we just created since edge failed
        const { error: cleanupError } = await supabase.from('endeavors').delete().eq('id', dbRecord.id)
        if (cleanupError) {
          console.error('Failed to cleanup endeavor after edge creation failure:', cleanupError)
        }
        return Response.json({ error: `Failed to create parent relationship: ${edgeError.message}` }, { status: 500 })
      }
    }

    // Context access is now handled via context_id column on endeavors
    // No need to maintain separate root_endeavor_ids arrays

    // Revalidate pages that show endeavor data
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')
    revalidatePath('/endeavors/[id]/daily/[date]', 'page') // Revalidate specific endeavor daily pages
    revalidatePath('/daily/[date]', 'page') // Revalidate daily pages

    // 🚨 ENFORCE CONTRACT: API fails if response doesn't match contract
    const responseData = { success: true as const, endeavorId: dbRecord.id }
    try {
      const validatedResponse = validateCreateEndeavorResponse(responseData)
      console.log('✅ Response contract validation passed')
      return Response.json(validatedResponse)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        console.error('🚨 RESPONSE CONTRACT VIOLATION:', error.message)
        // This is a 500 because it's a server-side contract violation
        return Response.json({
          error: 'Internal contract violation: Response format invalid',
          details: error.message
        }, { status: 500 })
      }
      throw error
    }
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      console.error('🚨 Validation Error:', error.issues)
      return Response.json({
        error: 'Invalid request format',
        issues: error.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
          ...(('received' in issue) && { received: issue.received })
        }))
      }, { status: 400 })
    }

    console.error('Error in endeavor creation:', error)
    return Response.json({
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
})