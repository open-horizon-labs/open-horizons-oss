import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/integrations/[service]
 * Disconnects a specific integration service for the user
 */
export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { service } = await context.params
    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Find the integration account
    const { data: account, error: findError } = await supabase
      .from('integration_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('service_name', service)
      .single()

    if (findError || !account) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Mark as revoked instead of deleting (for audit trail)
    const { error: updateError } = await supabase
      .from('integration_accounts')
      .update({
        status: 'revoked',
        updated_at: new Date().toISOString()
      })
      .eq('id', account.id)

    if (updateError) {
      console.error('Error revoking integration:', updateError)
      return NextResponse.json({ error: 'Failed to disconnect integration' }, { status: 500 })
    }

    // Log the disconnection
    await supabase
      .from('integration_sync_logs')
      .insert({
        integration_account_id: account.id,
        sync_type: 'manual',
        status: 'completed',
        entities_processed: 0,
        metadata: { action: 'account_disconnected' },
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/integrations/[service]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * GET /api/integrations/[service]
 * Gets details for a specific integration service
 */
export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { service }: { service: string } = await context.params
    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { data: account, error } = await supabase
      .from('integration_accounts')
      .select(`
        id,
        service_name,
        external_account_id,
        account_info,
        status,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .eq('service_name', service)
      .eq('status', 'active')
      .single()

    if (error || !account) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    return NextResponse.json({ account })
  } catch (error) {
    console.error('Error in GET /api/integrations/[service]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})