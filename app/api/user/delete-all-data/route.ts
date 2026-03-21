import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    console.log('🗑️ DELETE-ALL: Starting delete-all operation for user:', user.id)

    const body = await request.json()
    const { confirmText } = body

    console.log('🗑️ DELETE-ALL: Confirmation text received:', confirmText)

    // Double-check the confirmation text server-side
    if (confirmText !== 'YES I AM SURE') {
      console.log('🗑️ DELETE-ALL: Invalid confirmation, aborting')
      return NextResponse.json(
        { error: 'Invalid confirmation text' },
        { status: 400 }
      )
    }

    const userId = user.id
    console.log('🗑️ DELETE-ALL: Proceeding with delete-all for user:', userId)

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, userId)

    // Execute deletion step by step (Supabase handles transactions automatically)
    // Delete in order to avoid foreign key constraint issues

    // 1. Delete endeavors
    const { error: endeavorsError } = await supabase
      .from('endeavors')
      .delete()
      .eq('user_id', userId)

    if (endeavorsError) {
      throw new Error(`Failed to delete endeavors: ${endeavorsError.message}`)
    }

    // 2. Delete context memberships
    const { error: membershipsError } = await supabase
      .from('context_memberships')
      .delete()
      .eq('user_id', userId)

    if (membershipsError) {
      throw new Error(`Failed to delete context memberships: ${membershipsError.message}`)
    }

    // 3. Delete ALL user contexts (including any existing personal context)
    console.log(`🔍 DELETE-ALL: About to delete ALL contexts for user ${userId}`)

    // First, check how many contexts exist
    const { data: existingContexts, error: countError } = await supabase
      .from('contexts')
      .select('id, title, created_by')
      .eq('created_by', userId)

    if (countError) {
      console.error(`🔍 DELETE-ALL: Error counting contexts:`, countError)
    } else {
      console.log(`🔍 DELETE-ALL: Found ${existingContexts.length} contexts total`)
      console.log(`🔍 DELETE-ALL: Will delete ALL ${existingContexts.length} contexts:`)
      existingContexts.forEach((ctx, i) => {
        console.log(`  ${i+1}. ${ctx.id} - "${ctx.title}"`)
      })
    }

    // Delete ALL contexts created by the user
    const { error: contextsError, count } = await supabase
      .from('contexts')
      .delete({ count: 'exact' })
      .eq('created_by', userId)

    if (contextsError) {
      console.error(`🔍 DELETE-ALL: Context deletion error:`, contextsError)
      throw new Error(`Failed to delete contexts: ${contextsError.message}`)
    }

    console.log(`🔍 DELETE-ALL: Delete operation completed - claimed to delete ${count} contexts`)

    // Verify deletion worked
    const { data: remainingContexts, error: verifyError } = await supabase
      .from('contexts')
      .select('id, title, created_by')
      .eq('created_by', userId)

    if (!verifyError) {
      console.log(`🔍 DELETE-ALL: After deletion, ${remainingContexts.length} contexts remain`)
      if (remainingContexts.length > 0) {
        console.log(`🔍 DELETE-ALL: Remaining contexts:`)
        remainingContexts.forEach((ctx, i) => {
          console.log(`  ${i+1}. ${ctx.id} - "${ctx.title}"`)
        })
      }
    }

    // 4. Delete API keys
    const { error: apiKeysError } = await supabase
      .from('api_keys')
      .delete()
      .eq('user_id', userId)

    if (apiKeysError) {
      throw new Error(`Failed to delete API keys: ${apiKeysError.message}`)
    }

    // 5. Delete logs
    const { error: logsError } = await supabase
      .from('logs')
      .delete()
      .eq('user_id', userId)

    if (logsError) {
      throw new Error(`Failed to delete logs: ${logsError.message}`)
    }

    // 6. Ensure personal context still exists (it should have been preserved)
    const { ensurePersonalContext } = await import('../../../../lib/contexts/personal-context')
    const personalContextResult = await ensurePersonalContext(userId, supabase)

    if (!personalContextResult.success) {
      throw new Error(`Failed to ensure personal context: ${personalContextResult.error}`)
    }

    return NextResponse.json({
      success: true,
      message: 'All user data has been permanently deleted (fresh personal context created)',
      personalContextId: personalContextResult.contextId
    })

  } catch (error) {
    console.error('Delete all data API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
})