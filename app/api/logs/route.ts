/**
 * Temporal Logs API Routes
 *
 * Manages CRUD operations for temporal logs using contract validation.
 */

import { NextRequest } from 'next/server'
import { withAuth } from '../../../lib/auth-api'
import {
  validateCreateLogRequest,
  validateCreateLogRequestStrict,
  validateCreateLogResponse,
  validateCreateLogResponseStrict,
  transformCreateLogToDatabase,
  transformDatabaseToLogEntry,
  LogContractViolationError
} from '../../../lib/contracts/logs-contract'

/**
 * POST /api/logs - Create a new log entry
 */
export const POST = withAuth(async (request: NextRequest, user, authMethod) => {
  try {
    const requestBody = await request.json()
    console.log('📋 Request body received:', JSON.stringify(requestBody, null, 2))

    // Check if relaxed validation is explicitly requested via query parameter
    const { searchParams } = new URL(request.url)
    const useRelaxedValidation = searchParams.get('relaxed') === 'true'

    // 🚨 CONTRACT ENFORCEMENT: Use strict validation by default
    const validatedInput = useRelaxedValidation
      ? validateCreateLogRequest(requestBody)
      : validateCreateLogRequestStrict(requestBody)

    // Transform to database record
    const dbRecord = transformCreateLogToDatabase(validatedInput, user.id)
    console.log('🧪 DEBUG: About to insert log record:', JSON.stringify(dbRecord, null, 2))
    console.log('🧪 DEBUG: User ID from auth:', user.id)

    // Insert into database with proper auth context
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)
    const { data, error } = await supabase
      .from('logs')
      .insert([dbRecord])
      .select()
      .single()

    if (error) {
      console.error('Database error creating log:', error)

      // Handle specific database errors with appropriate status codes
      if (error.code === 'PGRST116' || error.message?.includes('policy')) {
        // RLS policy violation - user doesn't have access to this entity
        return Response.json({ error: 'Access denied: You do not have permission to create logs for this entity' }, { status: 403 })
      }

      if (error.code === '23505' || error.message?.includes('duplicate')) {
        // Duplicate key violation
        return Response.json({ error: 'A log entry with this ID already exists' }, { status: 409 })
      }

      if (error.code === '23503' || error.message?.includes('foreign key')) {
        // Foreign key violation - referenced entity doesn't exist
        return Response.json({ error: 'Referenced entity does not exist' }, { status: 400 })
      }

      // Generic database error
      return Response.json({ error: 'Failed to create log entry' }, { status: 500 })
    }

    // Transform database result
    const logEntry = transformDatabaseToLogEntry(data)
    const responseData = { success: true, log: logEntry }

    // 🚨 CONTRACT ENFORCEMENT: Use strict response validation by default
    if (useRelaxedValidation) {
      console.log('📤 RELAXED RESPONSE:', JSON.stringify(responseData, null, 2))
      return Response.json(responseData, { status: 201 })
    } else {
      console.log('🔧 STRICT RESPONSE VALIDATION')
      const validatedResponse = validateCreateLogResponseStrict(responseData)
      return Response.json(validatedResponse, { status: 201 })
    }

  } catch (error) {
    console.error('Error in logs POST:', error)

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
 * GET /api/logs - Retrieve log entries with filtering
 * Query params: entity_type, entity_id, start_date, end_date, limit
 */
export const GET = withAuth(async (request: NextRequest, user, authMethod) => {
  try {
    const { searchParams } = new URL(request.url)
    const entity_type = searchParams.get('entity_type')
    const entity_id = searchParams.get('entity_id')
    const log_date = searchParams.get('log_date')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50

    console.log('📋 GET logs request:', { entity_type, entity_id, log_date, start_date, end_date, limit })

    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)
    // RLS handles access control - users see logs for endeavors they have access to
    // (their own logs + logs from other members on shared context endeavors)
    let query = supabase
      .from('logs')
      .select('*')
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply filters
    if (entity_type) {
      query = query.eq('entity_type', entity_type)
    }
    if (entity_id) {
      query = query.eq('entity_id', entity_id)
    }
    if (log_date) {
      query = query.eq('log_date', log_date)
    }
    if (start_date && end_date) {
      query = query.gte('log_date', start_date).lte('log_date', end_date)
    } else if (start_date) {
      query = query.gte('log_date', start_date)
    } else if (end_date) {
      query = query.lte('log_date', end_date)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error retrieving logs:', error)
      return Response.json({ error: 'Failed to retrieve logs' }, { status: 500 })
    }

    // Transform results (relaxed)
    const logs = data.map(transformDatabaseToLogEntry)

    const responseData = {
      success: true,
      logs,
      count: logs.length,
      filters: { entity_type, entity_id, log_date, start_date, end_date, limit }
    }

    console.log('📤 GET logs response:', `${logs.length} logs returned`)

    return Response.json(responseData)

  } catch (error) {
    console.error('Error in logs GET:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})