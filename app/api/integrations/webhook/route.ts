import { NextResponse } from 'next/server'
import { supabaseServer } from '../../../../lib/supabaseServer'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/webhook
 * Webhook endpoint for Pipedream to send external entity updates
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      user_id,
      service_name,
      entities,
      sync_type = 'webhook',
      pipedream_connection_id
    } = body

    // Validate required fields
    if (!user_id || !service_name || !entities || !Array.isArray(entities)) {
      return NextResponse.json({
        error: 'user_id, service_name, and entities array are required'
      }, { status: 400 })
    }

    const supabase = await supabaseServer()

    // Find the integration account
    const { data: account, error: accountError } = await supabase
      .from('integration_accounts')
      .select('id')
      .eq('user_id', user_id)
      .eq('service_name', service_name)
      .eq('status', 'active')
      .single()

    if (accountError || !account) {
      console.error('Integration account not found:', { user_id, service_name, error: accountError })
      return NextResponse.json({ error: 'Integration account not found' }, { status: 404 })
    }

    // Start sync log
    const { data: syncLog, error: logError } = await supabase
      .from('integration_sync_logs')
      .insert({
        integration_account_id: account.id,
        sync_type,
        status: 'started',
        entities_processed: 0,
        entities_created: 0,
        entities_updated: 0,
        entities_deleted: 0,
        metadata: {
          pipedream_connection_id,
          entity_count: entities.length
        },
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating sync log:', logError)
    }

    let processedCount = 0
    let createdCount = 0
    let updatedCount = 0
    let deletedCount = 0
    const errors: string[] = []

    // Process each entity
    for (const entity of entities) {
      try {
        const {
          external_id,
          entity_type,
          title,
          data,
          start_time,
          end_time,
          action = 'upsert' // 'upsert', 'delete'
        } = entity

        if (!external_id || !entity_type) {
          errors.push(`Entity missing required fields: external_id or entity_type`)
          continue
        }

        if (action === 'delete') {
          // Delete the entity
          const { error: deleteError } = await supabase
            .from('external_entities')
            .delete()
            .eq('integration_account_id', account.id)
            .eq('external_id', external_id)
            .eq('entity_type', entity_type)

          if (!deleteError) {
            deletedCount++
          }
        } else {
          // Upsert the entity
          const { data: upsertedEntity, error: upsertError } = await supabase
            .from('external_entities')
            .upsert({
              integration_account_id: account.id,
              external_id,
              entity_type,
              title: title || null,
              data,
              start_time: start_time || null,
              end_time: end_time || null,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'integration_account_id,external_id,entity_type'
            })
            .select('id,created_at,updated_at')

          if (upsertError) {
            errors.push(`Error upserting entity ${external_id}: ${upsertError.message}`)
          } else if (upsertedEntity?.[0]) {
            // Simple heuristic: if created_at and updated_at are very close, it's likely a new record
            const entity = upsertedEntity[0]
            const createdAt = new Date(entity.created_at).getTime()
            const updatedAt = new Date(entity.updated_at).getTime()

            if (Math.abs(updatedAt - createdAt) < 1000) { // Within 1 second
              createdCount++
            } else {
              updatedCount++
            }
          }
        }

        processedCount++
      } catch (entityError) {
        console.error('Error processing entity:', entityError)
        errors.push(`Error processing entity: ${entityError}`)
      }
    }

    // Update sync log with results
    if (syncLog) {
      const status = errors.length === 0 ? 'completed' :
                    processedCount === 0 ? 'failed' : 'partial'

      await supabase
        .from('integration_sync_logs')
        .update({
          status,
          entities_processed: processedCount,
          entities_created: createdCount,
          entities_updated: updatedCount,
          entities_deleted: deletedCount,
          error_message: errors.length > 0 ? errors.join('; ') : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncLog.id)
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      created: createdCount,
      updated: updatedCount,
      deleted: deletedCount,
      errors: errors.length > 0 ? errors : undefined,
      syncLogId: syncLog?.id
    })

  } catch (error) {
    console.error('Error in webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/integrations/webhook
 * Health check endpoint for webhook
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Open Horizons Integration Webhook'
  })
}