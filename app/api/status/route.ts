import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Check database connection and counts
    const { data: endeavorsCount, error: endeavorsError } = await supabase
      .from('endeavors')
      .select('id', { count: 'exact', head: true })

    // Test RPC functions and check migration status
    const accessibleCount = 0
    const accessibleError = null

    // Check for key RPC functions from migrations
    const functionChecks = await Promise.allSettled([
      supabase.rpc('get_user_contexts', { p_user_id: user.id }),
      supabase.rpc('add_endeavor_to_context', {
        p_context_id: 'test',
        p_endeavor_id: 'test',
        p_user_id: user.id
      }).then(() => true, (err: any) => err.message),
      supabase.rpc('get_context_subgraph', {
        p_user_id: user.id,
        p_context_id: 'test'
      }).then(() => true, (err: any) => err.message)
    ])

    const migrationChecks = {
      get_user_contexts: functionChecks[0].status === 'fulfilled',
      add_endeavor_to_context: functionChecks[1].status === 'fulfilled' ||
        (functionChecks[1].status === 'rejected' && !functionChecks[1].reason?.includes?.('function "add_endeavor_to_context" does not exist')),
      get_context_subgraph: functionChecks[2].status === 'fulfilled' ||
        (functionChecks[2].status === 'rejected' && !functionChecks[2].reason?.includes?.('function "get_context_subgraph" does not exist'))
    }

    return Response.json({
      timestamp: new Date().toISOString(),
      database: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        endeavors_count: endeavorsCount?.length || 0,
        endeavors_error: endeavorsError
      },
      user: {
        id: user.id,
        email: user.email,
        accessible_endeavors_count: accessibleCount,
        accessible_error: accessibleError
      },
      migrations: migrationChecks,
      environment: process.env.NODE_ENV
    })
  } catch (error) {
    return Response.json({
      error: 'Status check failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
})