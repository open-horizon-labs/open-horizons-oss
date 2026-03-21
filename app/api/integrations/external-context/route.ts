import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { pipedreamService } from '../../../../lib/integrations/pipedream'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/external-context?date=YYYY-MM-DD
 * Returns external entities (calendar events, etc.) for a specific date
 */
export const GET = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 })
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json({ error: 'date must be in YYYY-MM-DD format' }, { status: 400 })
    }

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod('session', user.id)
    
    // Use the database function to get external context
    const { data: context, error } = await supabase
      .rpc('get_external_context_for_date', {
        target_user_id: user.id,
        target_date: date
      })

    if (error) {
      console.error('Error fetching external context:', error)
      return NextResponse.json({ error: 'Failed to fetch external context' }, { status: 500 })
    }

    // Group by service for easier consumption
    const contextByService: Record<string, any[]> = {}
    for (const item of context || []) {
      if (!contextByService[item.service_name]) {
        contextByService[item.service_name] = []
      }
      contextByService[item.service_name].push(item)
    }

    return NextResponse.json({
      date,
      context: contextByService,
      totalItems: context?.length || 0
    })
  } catch (error) {
    console.error('Error in GET /api/integrations/external-context:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * POST /api/integrations/external-context
 * Manually triggers a sync for external context (useful for testing)
 */
export const POST = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod('session', user.id)
    
    const body = await request.json()
    const { service_name, force = false } = body

    if (!service_name) {
      return NextResponse.json({ error: 'service_name is required' }, { status: 400 })
    }

    // Find the integration account
    const { data: account, error: findError } = await supabase
      .from('integration_accounts')
      .select('id, pipedream_connection_id, external_account_id')
      .eq('user_id', user.id)
      .eq('service_name', service_name)
      .eq('status', 'active')
      .single()

    if (findError || !account) {
      return NextResponse.json({ error: 'Integration not found or not active' }, { status: 404 })
    }

    if (!account.pipedream_connection_id) {
      return NextResponse.json({ error: 'No Pipedream connection ID found' }, { status: 400 })
    }

    // Log the sync request
    const { data: syncLog, error: logError } = await supabase
      .from('integration_sync_logs')
      .insert({
        integration_account_id: account.id,
        sync_type: 'manual',
        status: 'started',
        metadata: { triggered_by: 'api_request', force },
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating sync log:', logError)
    }

    // Sync calendar events if it's Google Calendar
    if (service_name === 'google_calendar') {
      try {
        // Sync events for the last 7 days and next 30 days
        const today = new Date()
        const pastDate = new Date(today)
        pastDate.setDate(today.getDate() - 7)
        const futureDate = new Date(today)
        futureDate.setDate(today.getDate() + 30)

        const startDate = pastDate.toISOString().split('T')[0]
        const endDate = futureDate.toISOString().split('T')[0]

        console.log('Syncing calendar events from', startDate, 'to', endDate)

        // Get the correct Pipedream account ID by finding it via external user ID
        const pipedreamAccounts = await pipedreamService.getUserAccounts(user.id)
        const googleCalendarAccount = pipedreamAccounts.find(acc => acc.service === 'google_calendar')

        if (!googleCalendarAccount) {
          throw new Error('No Google Calendar account found in Pipedream')
        }

        console.log('Found Pipedream account:', googleCalendarAccount.id, 'for service:', googleCalendarAccount.service)

        const syncResult = await pipedreamService.syncCalendarEvents(
          account.id,
          googleCalendarAccount.id,
          startDate,
          endDate,
          user.id,
          supabase
        )

        // Update sync log with results
        const updateData: any = {
          status: syncResult.success ? 'completed' : 'failed',
          entities_processed: syncResult.eventsProcessed,
          entities_created: syncResult.eventsProcessed, // For simplicity, assume all are new/updated
          completed_at: new Date().toISOString()
        }

        if (!syncResult.success && syncResult.error) {
          updateData.error_message = syncResult.error
        }

        if (syncLog?.id) {
          await supabase
            .from('integration_sync_logs')
            .update(updateData)
            .eq('id', syncLog.id)
        }

        return NextResponse.json({
          message: syncResult.success ? 'Calendar sync completed successfully' : 'Calendar sync failed',
          syncLogId: syncLog?.id,
          service: service_name,
          eventsProcessed: syncResult.eventsProcessed,
          success: syncResult.success,
          error: syncResult.error
        })
      } catch (error) {
        console.error('Error during calendar sync:', error)

        // Update sync log with error
        if (syncLog?.id) {
          await supabase
            .from('integration_sync_logs')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString()
            })
            .eq('id', syncLog.id)
        }

        return NextResponse.json({
          message: 'Calendar sync failed',
          syncLogId: syncLog?.id,
          service: service_name,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    // For other services, return success for now
    return NextResponse.json({
      message: 'Sync triggered successfully',
      syncLogId: syncLog?.id,
      service: service_name
    })
  } catch (error) {
    console.error('Error in POST /api/integrations/external-context:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})