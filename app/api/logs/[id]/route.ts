/**
 * Individual Log API Routes
 *
 * Manages update and delete operations for individual log entries.
 */

import { NextRequest } from 'next/server'
import { withAuth } from '../../../../lib/auth-api'
import {
  validateUpdateLogRequest,
  validateUpdateLogResponse,
  transformDatabaseToLogEntry,
  LogContractViolationError
} from '../../../../lib/contracts/logs-contract'

/**
 * PUT /api/logs/[id] - Update an existing log entry
 */
export const PUT = withAuth(async (request: NextRequest, user, authMethod, context) => {
  try {
    const { id } = await context.params
    const requestBody = await request.json()
    console.log('📋 PUT log request:', { id, body: JSON.stringify(requestBody, null, 2) })

    // 🚨 CONTRACT ENFORCEMENT: Validate update request
    const validatedInput = validateUpdateLogRequest(requestBody)

    // Get database client with proper auth context
    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // First, verify the log exists and belongs to the user
    const { data: existingLog, error: fetchError } = await supabase
      .from('logs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingLog) {
      console.error('Log not found or access denied:', fetchError)
      return Response.json({ error: 'Log not found or access denied' }, { status: 404 })
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (validatedInput.content !== undefined) {
      updateData.content = validatedInput.content
    }
    if (validatedInput.content_type !== undefined) {
      updateData.content_type = validatedInput.content_type
    }
    if (validatedInput.metadata !== undefined) {
      updateData.metadata = validatedInput.metadata
    }

    // Update the log
    const { data, error } = await supabase
      .from('logs')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error updating log:', error)

      // Handle specific database errors
      if (error.code === 'PGRST116' || error.message?.includes('policy')) {
        return Response.json({ error: 'Access denied: You do not have permission to update this log' }, { status: 403 })
      }

      return Response.json({ error: 'Failed to update log entry' }, { status: 500 })
    }

    // Transform and validate response
    const logEntry = transformDatabaseToLogEntry(data)
    const responseData = { success: true, log: logEntry }

    // 🚨 CONTRACT ENFORCEMENT: Validate response
    const validatedResponse = validateUpdateLogResponse(responseData)

    console.log('📤 PUT log response: Log updated successfully')
    return Response.json(validatedResponse)

  } catch (error) {
    console.error('Error in logs PUT:', error)

    if (error instanceof LogContractViolationError) {
      return Response.json({
        error: 'Contract validation failed',
        details: error.message
      }, { status: 400 })
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return Response.json({
        error: 'Invalid request data',
        details: error.message
      }, { status: 400 })
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * DELETE /api/logs/[id] - Delete an existing log entry
 */
export const DELETE = withAuth(async (request: NextRequest, user, authMethod, context) => {
  try {
    const { id } = await context.params
    console.log('📋 DELETE log request:', { id, userId: user.id })

    // Get database client with proper auth context
    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // First, verify the log exists and belongs to the user
    const { data: existingLog, error: fetchError } = await supabase
      .from('logs')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingLog) {
      console.error('Log not found or access denied:', fetchError)
      return Response.json({ error: 'Log not found or access denied' }, { status: 404 })
    }

    // Delete the log
    const { error } = await supabase
      .from('logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Database error deleting log:', error)

      // Handle specific database errors
      if (error.code === 'PGRST116' || error.message?.includes('policy')) {
        return Response.json({ error: 'Access denied: You do not have permission to delete this log' }, { status: 403 })
      }

      return Response.json({ error: 'Failed to delete log entry' }, { status: 500 })
    }

    console.log('📤 DELETE log response: Log deleted successfully')
    return Response.json({
      success: true,
      message: 'Log entry deleted successfully'
    })

  } catch (error) {
    console.error('Error in logs DELETE:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})