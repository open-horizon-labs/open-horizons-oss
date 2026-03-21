/**
 * Dive Pack API Routes (Single Resource)
 *
 * GET /api/dive-packs/:id - Get a single dive pack
 * PATCH /api/dive-packs/:id - Update dive pack status (archive/unarchive)
 * DELETE /api/dive-packs/:id - Delete a dive pack
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import {
  validateUpdateDivePackRequest,
  validateDivePackResponse,
  transformFromDatabase,
  DivePackContractViolationError
} from '../../../../lib/contracts/dive-pack-contract'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dive-packs/:id - Get a single dive pack
 */
export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { data, error } = await supabase
      .from('dive_packs')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Dive pack not found' },
        { status: 404 }
      )
    }

    const responseData = transformFromDatabase(data)
    const validatedResponse = validateDivePackResponse(responseData)
    return NextResponse.json(validatedResponse)

  } catch (error) {
    console.error('Error in dive-packs GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

/**
 * PATCH /api/dive-packs/:id - Update dive pack status
 */
export const PATCH = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const requestBody = await request.json()

    // Validate request
    const validatedInput = validateUpdateDivePackRequest(requestBody)

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Update the dive pack
    const { data, error } = await supabase
      .from('dive_packs')
      .update({ status: validatedInput.status })
      .eq('id', id)
      .eq('created_by', user.id) // Only owner can update
      .select()
      .single()

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Dive pack not found or access denied' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to update dive pack' },
        { status: 500 }
      )
    }

    const responseData = transformFromDatabase(data)
    const validatedResponse = validateDivePackResponse(responseData)
    return NextResponse.json(validatedResponse)

  } catch (error) {
    console.error('Error in dive-packs PATCH:', error)

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

/**
 * DELETE /api/dive-packs/:id - Delete a dive pack
 */
export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // First verify the pack exists and belongs to this user
    const { data: existing } = await supabase
      .from('dive_packs')
      .select('id, created_by')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Dive pack not found' },
        { status: 404 }
      )
    }

    if (existing.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Access denied: you can only delete your own dive packs' },
        { status: 403 }
      )
    }

    // Delete the dive pack
    const { error } = await supabase
      .from('dive_packs')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete dive pack' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in dive-packs DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
