import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth, AuthenticatedUser } from '../../../lib/auth-api'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations
 * Returns all integration accounts for the authenticated user
 */
export const GET = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod('session', user.id)

    const { data: accounts, error } = await supabase
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
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching integration accounts:', error)
      return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
    }

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Error in GET /api/integrations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * POST /api/integrations
 * Creates or updates an integration account
 */
export const POST = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod('session', user.id)

    const body = await request.json()
    const {
      service_name,
      external_account_id,
      account_info,
      pipedream_connection_id,
      access_token_encrypted,
      refresh_token_encrypted
    } = body

    if (!service_name || !external_account_id) {
      return NextResponse.json(
        { error: 'service_name and external_account_id are required' },
        { status: 400 }
      )
    }

    // Upsert the integration account
    const { data: account, error } = await supabase
      .from('integration_accounts')
      .upsert({
        user_id: user.id,
        service_name,
        external_account_id,
        account_info: account_info || {},
        pipedream_connection_id,
        access_token_encrypted,
        refresh_token_encrypted,
        status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,service_name'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating/updating integration account:', error)
      return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 })
    }

    // Log the connection event
    await supabase
      .from('integration_sync_logs')
      .insert({
        integration_account_id: account.id,
        sync_type: 'manual',
        status: 'completed',
        entities_processed: 0,
        metadata: { action: 'account_connected' },
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })

    return NextResponse.json({ account })
  } catch (error) {
    console.error('Error in POST /api/integrations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})