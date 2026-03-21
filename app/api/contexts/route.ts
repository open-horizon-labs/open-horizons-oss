import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { getUserContexts, createContext } from '../../../lib/contexts/context-operations'
import { ensurePersonalContext } from '../../../lib/contexts/personal-context'
import { supabaseServer } from '../../../lib/supabaseServer'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    console.log('📡 API /contexts - Starting request')
    console.log('📡 API /contexts - User:', user?.id, user?.email)

    // Get properly authenticated Supabase client that respects RLS
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Ensure personal context exists before querying contexts
    console.log('📡 API /contexts - Ensuring personal context for user:', user.id)
    const personalContextResult = await ensurePersonalContext(user.id, supabase)
    console.log('📡 API /contexts - ensurePersonalContext result:', {
      success: personalContextResult.success,
      contextId: personalContextResult.contextId,
      error: personalContextResult.error
    })

    if (!personalContextResult.success) {
      console.error('📡 API /contexts - Failed to ensure personal context:', personalContextResult.error)
      // Continue anyway to return any existing contexts
    }

    console.log('📡 API /contexts - Calling getUserContexts for userId:', user.id)
    let contexts: any[]
    try {
      contexts = await getUserContexts(user.id)
      console.log('📡 API /contexts - getUserContexts SUCCESS - Contexts returned:', contexts.length, contexts.map(c => ({ id: c.id, title: c.title, is_owner: c.is_owner })))
    } catch (error) {
      console.error('📡 API /contexts - getUserContexts ERROR:', error)
      contexts = []
    }
    console.log('📡 API /contexts - Final contexts to return:', contexts.length)

    return NextResponse.json({
      contexts,
      count: contexts.length
    })
  } catch (error) {
    console.error('Error fetching contexts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contexts' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    const { title, description, sharedEndeavors } = await request.json()

    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const result = await createContext(
      user.id,
      title,
      description,
      sharedEndeavors,
      supabase
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      contextId: result.contextId
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating context:', error)
    return NextResponse.json(
      { error: 'Failed to create context' },
      { status: 500 }
    )
  }
})