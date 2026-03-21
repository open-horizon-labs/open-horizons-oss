/**
 * Dive Packs API Routes
 *
 * POST /api/dive-packs - Create a new dive pack
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../lib/auth-api'
import {
  validateCreateDivePackRequest,
  validateDivePackResponse,
  transformToDatabase,
  transformFromDatabase,
  DivePackContractViolationError
} from '../../../lib/contracts/dive-pack-contract'

/**
 * POST /api/dive-packs - Create a new dive pack
 */
export const POST = withAuth(async (request: NextRequest, user, authMethod) => {
  try {
    const requestBody = await request.json()

    // Validate request
    const validatedInput = validateCreateDivePackRequest(requestBody)

    // Transform to database record
    const dbRecord = transformToDatabase(validatedInput, user.id)

    // Insert into database with proper auth context
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Verify the endeavor exists and user has access
    const { data: endeavor, error: endeavorError } = await supabase
      .from('endeavors')
      .select('id')
      .eq('id', validatedInput.primary_endeavor_id)
      .single()

    if (endeavorError || !endeavor) {
      return NextResponse.json(
        { error: 'Endeavor not found or access denied' },
        { status: 404 }
      )
    }

    // Insert the dive pack
    const { data, error } = await supabase
      .from('dive_packs')
      .insert([dbRecord])
      .select()
      .single()

    if (error) {
      console.error('Database error creating dive pack:', error)

      if (error.code === '23503' || error.message?.includes('foreign key')) {
        return NextResponse.json(
          { error: 'Referenced endeavor does not exist' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create dive pack' },
        { status: 500 }
      )
    }

    const responseData = transformFromDatabase(data)
    const validatedResponse = validateDivePackResponse(responseData)
    return NextResponse.json(validatedResponse, { status: 201 })

  } catch (error) {
    console.error('Error in dive-packs POST:', error)

    if (error instanceof DivePackContractViolationError) {
      return NextResponse.json(
        { error: 'Contract validation failed', details: error.message },
        { status: 400 }
      )
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
