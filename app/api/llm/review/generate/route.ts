import { NextRequest, NextResponse } from 'next/server'
import {
  ReviewRequest,
  ReviewResponse,
  computeInputsHash,
  nowIso,
  sha256,
  ulidLike,
  validateReviewRequest,
  validateReviewResponse,
  gradeAtLeastBMinus
} from '../../../../../lib/schemas/review'
import { withSimpleAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { fetchUserProfile } from '../../../../../lib/llm/profileService'

// In-memory idempotency cache for the walking skeleton
const cache = new Map<string, ReviewResponse>()

export const dynamic = 'force-dynamic'

export const POST = withSimpleAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  const started = Date.now()
  const events: ReviewResponse['events'] = [
    { kind: 'run.started', ts: nowIso() }
  ]

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!validateReviewRequest(body)) {
    events.push({ kind: 'validator.failed', phase: 'Design', ts: nowIso(), note: 'schema.request' })
    return NextResponse.json({ error: 'Invalid ReviewRequest schema', events }, { status: 400 })
  }
  const reviewReq: ReviewRequest = body

  // 🚨 SECURITY: Override user.id from authenticated user (don't trust request body)
  reviewReq.user.id = user.id

  // Fetch user profile if not already included
  if (!reviewReq.user.profile && reviewReq.user.id) {
    try {
      const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
      const supabase = await getSupabaseForAuthMethod('session', user.id)
      const userProfile = await fetchUserProfile(supabase, reviewReq.user.id)
      if (userProfile) {
        reviewReq.user.profile = userProfile
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      // Continue without profile data
    }
  }

  // Build inputs_hash per spec
  const inputs_hash = computeInputsHash(reviewReq)

  // Idempotency: de-dupe by (user_id, date, inputs_hash)
  const dedupeKey = sha256(`${reviewReq.user.id}|${reviewReq.doc.date}|${inputs_hash}`)

  // Return cached if exists
  const cached = cache.get(dedupeKey)
  if (cached) {
    return NextResponse.json(cached, { status: 200 })
  }

  // Assemble prompt (Clarify/Delimit/Direction/Design)
  const model = process.env.OPENAI_MODEL || 'gpt-5-nano'
  const allowedEfforts = new Set(['minimal', 'low', 'medium', 'high'])
  const envEffort = (process.env.OPENAI_REASONING_EFFORT || 'minimal').toLowerCase()
  const reasoningEffort = allowedEfforts.has(envEffort) ? envEffort : 'minimal'
  const maxTokens = reviewReq.options?.max_tokens ?? 800
  const temperature = reviewReq.options?.temperature ?? 0.3

  const promptParts: string[] = []

  // User Profile Context (at the top for optimal LLM attention)
  if (reviewReq.user.profile) {
    const { about_me, llm_personalization } = reviewReq.user.profile
    if (about_me) {
      promptParts.push(`User Context: ${about_me}`)
    }
    if (llm_personalization) {
      promptParts.push(`Personalization Instructions: ${llm_personalization}`)
    }
    if (about_me || llm_personalization) {
      promptParts.push('') // Add blank line for separation
    }
  }

  // Model Prompt (walking skeleton) aligned with review-service.md
  promptParts.push(
    'You are the Review Agent for Open Horizons Daily Ritual. Your sole job is to produce a JSON object that increases clarity for the next day based only on TODAY\'s note and explicitly provided attachments. You must not invent missing facts. If the user left any field blank (e.g., Win/Learning/Adjust), acknowledge it and offer brief guidance, but do not fabricate content. Output exactly the ReviewResponse.draft fields described in the schema. Keep language concise and actionable.'
  )
  promptParts.push(`Date: ${reviewReq.doc.date}`)
  if (reviewReq.doc.context?.tree) {
    promptParts.push(`Context: tree=${reviewReq.doc.context.tree}`)
  }

  const b = reviewReq.doc.blocks
  promptParts.push('Blocks:')
  promptParts.push(`- Done: ${b.done.map((d) => `${d.time} ${d.text} ${(d.aims ?? []).join(' ')}`).join(' | ')}`)
  promptParts.push(`- Aim links: ${b.aim_links.map((a) => `${a.tag} ${a.note}`).join(' | ')}`)
  promptParts.push(`- Next: ${b.next.join(' | ')}`)
  promptParts.push(`- Reflection: Win=${b.reflection.win} | Learning=${b.reflection.learning} | Adjust=${b.reflection.adjust}`)

  const atts = reviewReq.doc.attachments ?? []
  if (atts.length > 0) {
    promptParts.push('Attachments:')
    for (const a of atts) promptParts.push(`- [${a.type}] ${a.title} ${a.uri} (updated ${a.updated}) ${a.note ?? ''}`)
  }
  promptParts.push('Produce only these fields under draft: summary, applied_strengths (0..N), highlights (1..5), aims_advanced (0..N of {tag,rationale}), risks (0..N), next_recommendations (1..3). If reflection fields are blank, include at most 2 neutral prompts in next_recommendations (e.g., "Write one learning you want to retain."). Do not include any keys beyond the schema. Do not return Markdown; return plain strings. Return only JSON for the draft fields. No prose outside JSON.')

  const prompt = promptParts.join('\n')
  const prompt_hash = sha256(prompt)

  events.push({ kind: 'gate.passed', phase: 'Direction', ts: nowIso() })
  events.push({ kind: 'gate.passed', phase: 'Design', ts: nowIso() })

  // Call OpenAI (Responses API) or return stub when key missing or call fails
  const apiKey = process.env.OPENAI_API_KEY
  let draft: ReviewResponse['draft'] | null = null
  let tokens_used = 0
  let modelReadability: string | undefined
  const failToStub = async (reason: string) => {
    // Minimal stub compliant with schema; strengths can be 0
    draft = {
      summary: `Today you focused on ${b.next[0] ?? 'your priorities'}. Win: ${b.reflection.win || '—'}. Learning: ${b.reflection.learning || '—'}. Adjust: ${b.reflection.adjust || '—'}.` ,
      applied_strengths: [],
      highlights: b.done.slice(0, 3).map((d) => d.text).filter(Boolean),
      aims_advanced: b.aim_links.map((a) => ({ tag: a.tag, rationale: a.note })),
      risks: [],
      next_recommendations: (b.next.length > 0 ? b.next : ['Clarify your top 1–3 items for tomorrow.']).slice(0, 3)
    }
    modelReadability = 'B-'
    tokens_used = 0
    events.push({ kind: 'note', phase: 'Develop', ts: nowIso(), note: `stub: ${reason}` })
  }

  if (!apiKey) {
    await failToStub('OPENAI_API_KEY missing')
  } else {
    try {
      const payload = {
        model,
        temperature,
        max_output_tokens: maxTokens,
        reasoning: { effort: reasoningEffort },
        input: `System: You are a structured writing assistant. Output only valid JSON.\n\n${prompt}`
      }
      const resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}`)
      const data = await resp.json()
      const content: string =
        (typeof data.output_text === 'string' && data.output_text) ||
        data.output?.[0]?.content?.[0]?.text ||
        data.output?.[0]?.content?.[0]?.output_text ||
        data.choices?.[0]?.message?.content ||
        ''
      tokens_used =
        (typeof data.usage?.total_tokens === 'number' && data.usage.total_tokens) ||
        ((data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)) ||
        0
      try {
        const parsed = JSON.parse(content)
        // Accept either full response or just draft shape
        if (parsed && parsed.draft) {
          draft = parsed.draft
          modelReadability = parsed?.checks?.readability_grade
        } else {
          draft = parsed as ReviewResponse['draft']
        }
      } catch (e) {
        await failToStub('Model did not return JSON')
      }
    } catch (e: any) {
      await failToStub(e?.message || 'OpenAI call failed')
    }
  }

  if (!draft) {
    await failToStub('No draft parsed')
  }

  // Compute checks
  const winPresent = !!(b.reflection.win || '').trim()
  const learningPresent = !!(b.reflection.learning || '').trim()
  const adjustPresent = !!(b.reflection.adjust || '').trim()
  const triadPresent = winPresent && learningPresent && adjustPresent
  const hasAimFromDone = b.done.some((d) => (d.aims ?? []).length > 0)
  const hasAimFromLinks = b.aim_links.length > 0
  const hasAimFromNext = b.next.some((n) => /#Aim\//i.test(n))
  const aimLinked = hasAimFromDone || hasAimFromLinks || hasAimFromNext
  const readability = modelReadability || 'B-'

  // If reflection parts are blank, append up to two neutral guidance prompts
  if (draft) {
    const guidance: string[] = []
    if (!winPresent) guidance.push('Note one concrete win from today.')
    if (!learningPresent) guidance.push('Write one learning you want to retain.')
    if (!adjustPresent) guidance.push('Name one small adjustment for tomorrow.')
    if (guidance.length > 0) {
      const dedup = new Set([...(draft.next_recommendations || []), ...guidance.slice(0, 2)])
      draft.next_recommendations = Array.from(dedup).slice(0, 3)
    }
  }

  const response: ReviewResponse = {
    run_id: ulidLike(),
    draft: draft!,
    checks: {
      reflection_triad: triadPresent,
      aim_linked: aimLinked,
      readability_grade: readability
    },
    metrics: {
      tokens_used,
      latency_ms: Date.now() - started
    },
    provenance: {
      model,
      prompt_hash,
      inputs_hash,
      ts: nowIso()
    },
    events: events
  }

  // Validate output (report-only semantics for MVP)
  const schemaOk = validateReviewResponse(response)
  const readabilityOk = gradeAtLeastBMinus(response.checks.readability_grade)
  // reflection_triad and aim_linked are report-only / soft-warn
  if (!schemaOk) {
    events.push({ kind: 'validator.failed', phase: 'Develop', ts: nowIso(), note: 'schema.response' })
  } else {
    events.push({ kind: 'validator.passed', phase: 'Develop', ts: nowIso() })
  }
  // Surface metrics & checks; do not enforce SLOs
  events.push({ kind: 'node.succeeded', ts: nowIso() })

  // Cache result for idempotency
  cache.set(dedupeKey, response)

  return NextResponse.json(response, { status: 200 })
})
