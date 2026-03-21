/**
 * POST /api/reflect/extract
 *
 * Extracts metis and guardrail candidates from logs using LLM.
 * Stores candidates in database for user review.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { callLLM } from '../../../../lib/llm/client'
import {
  validateExtractRequest,
  ExtractCandidatesResponse,
  ExtractedCandidate,
  ReflectContractViolationError
} from '../../../../lib/contracts/reflect-contract'
import { DEFAULT_EXTRACTION_PROMPT } from '../../../../lib/prompts/reflect-extraction'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  try {
    const body = await request.json()
    const validatedInput = validateExtractRequest(body)
    const { endeavor_id, include_children, include_parent, include_siblings } = validatedInput

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Get the endeavor and verify access
    const { data: endeavor, error: endeavorError } = await supabase
      .from('endeavors')
      .select('id, title, context_id, parent_id, last_reviewed_at')
      .eq('id', endeavor_id)
      .single()

    if (endeavorError || !endeavor) {
      return NextResponse.json(
        { error: 'Endeavor not found' },
        { status: 404 }
      )
    }

    // Collect endeavor IDs to fetch logs from
    const endeavorIds = [endeavor_id]

    if (include_parent && endeavor.parent_id) {
      endeavorIds.push(endeavor.parent_id)
    }

    if (include_children) {
      const { data: children } = await supabase
        .from('endeavors')
        .select('id')
        .eq('parent_id', endeavor_id)
        .eq('is_archived', false)

      if (children) {
        endeavorIds.push(...children.map(c => c.id))
      }
    }

    if (include_siblings && endeavor.parent_id) {
      const { data: siblings } = await supabase
        .from('endeavors')
        .select('id')
        .eq('parent_id', endeavor.parent_id)
        .neq('id', endeavor_id)
        .eq('is_archived', false)

      if (siblings) {
        endeavorIds.push(...siblings.map(s => s.id))
      }
    }

    // Fetch metadata for all endeavors to include context in prompt
    const { data: endeavorMetadata } = await supabase
      .from('endeavors')
      .select('id, title, node_type, context_id')
      .in('id', endeavorIds)

    // Build map of endeavor id -> metadata for quick lookup
    type EndeavorMeta = { id: string; title: string; node_type: string; context_id: string }
    const endeavorMap = new Map<string, EndeavorMeta>(
      (endeavorMetadata || []).map((e: EndeavorMeta) => [e.id, e])
    )

    // Fetch logs since last review (or all if never reviewed)
    let logsQuery = supabase
      .from('logs')
      .select('id, entity_id, log_date, content, created_at')
      .eq('entity_type', 'endeavor')
      .in('entity_id', endeavorIds)
      .order('log_date', { ascending: false })
      .limit(50) // Limit to prevent token overflow

    if (endeavor.last_reviewed_at) {
      logsQuery = logsQuery.gt('created_at', endeavor.last_reviewed_at)
    }

    const { data: logs, error: logsError } = await logsQuery

    if (logsError) {
      console.error('Failed to fetch logs:', logsError)
      return NextResponse.json(
        { error: 'Failed to fetch logs' },
        { status: 500 }
      )
    }

    if (!logs || logs.length === 0) {
      const response: ExtractCandidatesResponse = {
        success: true,
        candidates_created: 0,
        candidates: [],
        logs_processed: 0
      }
      return NextResponse.json(response)
    }

    // Fetch existing metis and guardrails for context
    const { data: existingMetis } = await supabase
      .rpc('get_endeavor_metis_summary', { p_endeavor_id: endeavor_id })

    const { data: existingGuardrails } = await supabase
      .rpc('get_endeavor_guardrails', { p_endeavor_id: endeavor_id })

    // Build the prompt with logs and existing knowledge
    // Include endeavor context so LLM can associate candidates with source
    const logsText = logs.map(log => {
      const sourceEndeavor = endeavorMap.get(log.entity_id)
      const endeavorPrefix = sourceEndeavor
        ? `[${sourceEndeavor.node_type}: ${sourceEndeavor.title}]`
        : '[Unknown Endeavor]'
      return `${endeavorPrefix} [${log.log_date}] ${log.content}`
    }).join('\n\n')

    const existingKnowledgeText = [
      ...(existingMetis || []).map((m: any) => `METIS: ${m.title} - ${m.content}`),
      ...(existingGuardrails || []).map((g: any) => `GUARDRAIL: ${g.title} - ${g.description || ''}`)
    ].join('\n')

    const userPrompt = `Analyze these logs for "${endeavor.title}" and extract metis and guardrail candidates.

EXISTING KNOWLEDGE (avoid duplicates):
${existingKnowledgeText || '(none yet)'}

LOGS TO ANALYZE:
${logsText}

Extract candidates as a JSON array. Return [] if no genuine learnings are found.`

    // Call LLM
    const llmResult = await callLLM({
      messages: [
        { role: 'system', content: DEFAULT_EXTRACTION_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.3
    })

    // Parse LLM response
    let extractedCandidates: ExtractedCandidate[] = []
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = llmResult.content.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
      }

      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed)) {
        extractedCandidates = parsed.filter((c: any) =>
          c.type && c.content && (c.type === 'metis' || c.type === 'guardrail')
        )
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError)
      console.error('LLM response was:', llmResult.content)
      // Return success with no candidates rather than failing
      const response: ExtractCandidatesResponse = {
        success: true,
        candidates_created: 0,
        candidates: [],
        tokens_used: llmResult.tokens_used,
        logs_processed: logs.length
      }
      return NextResponse.json(response)
    }

    // Store candidates in database
    const storedCandidates = []
    for (const candidate of extractedCandidates) {
      const tableName = candidate.type === 'metis' ? 'metis_candidates' : 'guardrail_candidates'

      // Match source_endeavor title back to endeavor_id
      // Default to root endeavor_id if no match found
      let targetEndeavorId = endeavor_id
      let targetContextId = endeavor.context_id

      if (candidate.source_endeavor) {
        for (const [id, meta] of endeavorMap.entries()) {
          if (meta.title === candidate.source_endeavor) {
            targetEndeavorId = id
            targetContextId = meta.context_id
            break
          }
        }
      }

      const insertData: any = {
        endeavor_id: targetEndeavorId,
        context_id: targetContextId,
        content: candidate.content,
        source_type: 'llm_extraction',
        status: 'pending'
      }

      // Add type-specific fields
      if (candidate.type === 'metis') {
        insertData.violated_expectation = candidate.violated_expectation || null
        insertData.observed_reality = candidate.observed_reality || null
        insertData.consequence = candidate.consequence || null
        insertData.confidence = candidate.confidence || 'medium'
      } else {
        insertData.severity = candidate.severity || 'soft'
        insertData.override_protocol = candidate.override_protocol || null
      }

      const { data: inserted, error: insertError } = await supabase
        .from(tableName)
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        console.error(`Failed to insert ${candidate.type} candidate:`, insertError)
        continue
      }

      storedCandidates.push({
        ...inserted,
        type: candidate.type
      })
    }

    const response: ExtractCandidatesResponse = {
      success: true,
      candidates_created: storedCandidates.length,
      candidates: storedCandidates,
      tokens_used: llmResult.tokens_used,
      logs_processed: logs.length
    }

    return NextResponse.json(response)

  } catch (error) {
    if (error instanceof ReflectContractViolationError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.details },
        { status: 400 }
      )
    }
    console.error('Extract candidates error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
