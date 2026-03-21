import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { pipedreamService } from '../../../../lib/integrations/pipedream'
import { supabaseServer } from '../../../../lib/supabaseServer'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/connect
 * Initiates OAuth flow for a service via Pipedream Connect
 */
export const POST = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod('session', user.id)

    const body = await request.json()
    const { service_name, redirect_uri } = body

    if (!service_name) {
      return NextResponse.json({ error: 'service_name is required' }, { status: 400 })
    }

    try {
      // Create Pipedream Connect token
      const { url, token, expiresAt } = await pipedreamService.createConnectToken(
        service_name,
        user.id
      )

      // Store the pending connection in our database
      const { error: insertError } = await supabase
        .from('integration_accounts')
        .upsert({
          user_id: user.id,
          service_name,
          external_account_id: `pending_${token}`,
          status: 'active', // Will be updated after successful connection
          pipedream_connection_id: token,
          account_info: { token, expiresAt, connecting: true },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,service_name'
        })

      if (insertError) {
        console.error('Error storing pending connection:', insertError)
      }

      return NextResponse.json({
        connect_url: url,
        token,
        expires_at: expiresAt,
        service: service_name
      })
    } catch (error) {
      console.error('Error creating Connect session:', error)
      return NextResponse.json({
        error: 'Failed to create OAuth session',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in POST /api/integrations/connect:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * GET /api/integrations/connect/callback
 * Handles OAuth callback from Pipedream Connect
 */
export const GET = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const status = searchParams.get('status')
    const error = searchParams.get('error')

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod('session', user.id)

    // Find the pending connection
    const { data: account, error: findError } = await supabase
      .from('integration_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('pipedream_connection_id', sessionId)
      .single()

    if (findError || !account) {
      return NextResponse.json({ error: 'Connection session not found' }, { status: 404 })
    }

    if (error || status !== 'success') {
      // OAuth failed, update status
      await supabase
        .from('integration_accounts')
        .update({
          status: 'error',
          account_info: {
            ...account.account_info,
            error: error || 'OAuth flow failed',
            failed_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id)

      return NextResponse.json({
        error: 'OAuth connection failed',
        details: error || 'Unknown error'
      }, { status: 400 })
    }

    try {
      // Get connection details from Pipedream
      const connection = await pipedreamService.getAccount(sessionId)

      if (!connection) {
        throw new Error('Failed to retrieve connection from Pipedream')
      }

      // Update the account with successful connection details
      const { error: updateError } = await supabase
        .from('integration_accounts')
        .update({
          external_account_id: connection.metadata?.account_id || connection.id,
          status: 'active',
          account_info: {
            name: connection.metadata?.name || 'Connected Account',
            email: connection.metadata?.email,
            avatar: connection.metadata?.avatar_url,
            connected_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id)

      if (updateError) {
        console.error('Error updating connection:', updateError)
        return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })
      }

      // Log successful connection
      await supabase
        .from('integration_sync_logs')
        .insert({
          integration_account_id: account.id,
          sync_type: 'oauth_callback',
          status: 'completed',
          entities_processed: 0,
          metadata: {
            action: 'account_connected',
            service: account.service_name
          },
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })

      return NextResponse.json({
        success: true,
        service: account.service_name,
        account_info: connection.metadata
      })
    } catch (error) {
      console.error('Error processing OAuth callback:', error)

      // Update account with error status
      await supabase
        .from('integration_accounts')
        .update({
          status: 'error',
          account_info: {
            ...account.account_info,
            error: error instanceof Error ? error.message : 'Connection processing failed',
            failed_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id)

      return NextResponse.json({
        error: 'Failed to process connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in GET /api/integrations/connect/callback:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})