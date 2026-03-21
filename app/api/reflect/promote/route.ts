/**
 * POST /api/reflect/promote
 *
 * Promote a candidate to a full metis entry or guardrail.
 * Enforces hard gates from metis-guardrails-spec.md.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import {
  validatePromoteRequest,
  PromoteCandidateResponse,
  ReflectContractViolationError
} from '../../../../lib/contracts/reflect-contract'

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  // Parse body first so we can use type in error messages
  let body: { type?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const validatedRequest = validatePromoteRequest(body)

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { candidate_id, type } = validatedRequest

    // Get the candidate
    const tableName = type === 'metis' ? 'metis_candidates' : 'guardrail_candidates'
    const { data: candidate, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', candidate_id)
      .single()

    if (fetchError || !candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    if (candidate.status !== 'pending') {
      return NextResponse.json(
        { error: `Candidate already ${candidate.status}` },
        { status: 400 }
      )
    }

    let promotedId: string

    if (type === 'metis') {
      // Create metis entry
      const metisEntry = {
        endeavor_id: candidate.endeavor_id,
        context_id: candidate.context_id,
        title: validatedRequest.title,
        content: candidate.content,
        source_type: 'harvested' as const,
        source_id: candidate_id,
        confidence: validatedRequest.confidence || 'medium',
        violated_expectation: validatedRequest.violated_expectation,
        observed_reality: validatedRequest.observed_reality,
        consequence: validatedRequest.consequence,
        status: 'active',
        created_by: user.id
      }

      const { data: metis, error: insertError } = await supabase
        .from('metis_entries')
        .insert(metisEntry)
        .select('id')
        .single()

      if (insertError) {
        console.error('Failed to create metis entry:', insertError)
        return NextResponse.json(
          { error: 'Failed to create metis entry', details: insertError.message },
          { status: 500 }
        )
      }

      promotedId = metis.id
    } else {
      // Create guardrail
      const guardrailEntry = {
        endeavor_id: candidate.endeavor_id,
        context_id: candidate.context_id,
        title: validatedRequest.title,
        description: validatedRequest.description || candidate.content,
        severity: validatedRequest.severity || 'soft',
        enforcement: validatedRequest.enforcement || 'require_rationale',
        override_protocol: validatedRequest.override_protocol,
        rationale: `Promoted from candidate: ${candidate.content}`,
        status: 'active',
        created_by: user.id
      }

      const { data: guardrail, error: insertError } = await supabase
        .from('guardrails')
        .insert(guardrailEntry)
        .select('id')
        .single()

      if (insertError) {
        console.error('Failed to create guardrail:', insertError)
        return NextResponse.json(
          { error: 'Failed to create guardrail', details: insertError.message },
          { status: 500 }
        )
      }

      promotedId = guardrail.id
    }

    // Update candidate status
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        status: 'promoted',
        promoted_to: promotedId,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', candidate_id)

    if (updateError) {
      console.error('Failed to update candidate status:', updateError)
    }

    const response: PromoteCandidateResponse = {
      success: true,
      promoted_id: promotedId,
      type
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof ReflectContractViolationError) {
      // Extract field names from Zod validation errors for clearer error messages
      const details = error.details as Array<{ path?: string[]; message?: string }>
      const fieldNames = details
        ?.map(d => d.path?.join('.') || d.message)
        .filter(Boolean)
      const fieldList = fieldNames?.length ? `: ${fieldNames.join(', ')}` : ''

      // Type-specific error message based on what was requested
      const typeHint = body.type === 'metis'
        ? 'Metis requires title, violated_expectation, observed_reality, consequence.'
        : body.type === 'guardrail'
        ? 'Guardrail requires title, override_protocol.'
        : 'Metis requires title, violated_expectation, observed_reality, consequence. Guardrail requires title, override_protocol.'

      return NextResponse.json(
        {
          error: `Validation failed${fieldList}. ${typeHint}`,
          details: error.details
        },
        { status: 400 }
      )
    }
    console.error('Promote error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
