import crypto from 'crypto'

// Types derived from docs/mvp/daily ritual/review-service.md
export type ReviewRequest = {
  user: {
    id: string
    tier?: 'dev' | 'prod' | string
    profile?: {
      about_me?: string
      llm_personalization?: string
    }
  }
  doc: {
    date: string // YYYY-MM-DD
    blocks: {
      done: { time: string; text: string; aim_tag?: string; aims?: string[] }[]
      aim_links: { tag: string; note: string }[]
      next: string[]
      reflection: { win: string; learning: string; adjust: string }
    }
    attachments?: { type: string; title: string; uri: string; updated: string; note?: string }[]
    context?: { tree?: string; node?: string }
  }
  options?: { max_tokens?: number; temperature?: number }
}

export type ReviewResponse = {
  run_id: string
  draft: {
    summary: string
    applied_strengths: string[]
    highlights: string[]
    aims_advanced: { tag: string; rationale: string }[]
    risks: string[]
    next_recommendations: string[]
  }
  checks: {
    reflection_triad: boolean
    aim_linked: boolean
    readability_grade: string // e.g., B-
  }
  metrics: { tokens_used: number; latency_ms: number }
  provenance: { model: string; prompt_hash: string; inputs_hash: string; ts: string }
  events: { kind: string; phase?: string; ts: string; note?: string }[]
}

// Lightweight validation without external deps.
export function validateReviewRequest(req: any): req is ReviewRequest {
  if (!req || typeof req !== 'object') return false
  if (!req.user || typeof req.user.id !== 'string') return false
  if (!req.doc || typeof req.doc.date !== 'string') return false
  const b = req.doc.blocks
  if (!b) return false
  if (!Array.isArray(b.done) || !Array.isArray(b.aim_links) || !Array.isArray(b.next)) return false
  const r = b.reflection
  if (!r || ['win', 'learning', 'adjust'].some((k) => typeof r[k] !== 'string')) return false
  return true
}

export function validateReviewResponse(res: any): res is ReviewResponse {
  if (!res || typeof res !== 'object') return false
  if (!res.run_id || !res.draft || !res.checks || !res.metrics || !res.provenance || !res.events) return false
  if (typeof res.draft.summary !== 'string') return false
  if (!Array.isArray(res.draft.applied_strengths)) return false
  if (!Array.isArray(res.draft.highlights)) return false
  if (!Array.isArray(res.draft.next_recommendations)) return false
  if (typeof res.checks.readability_grade !== 'string') return false
  return true
}

// Canonicalization helpers
export function canonicalizeBlocks(blocks: ReviewRequest['doc']['blocks']): string {
  // Order-agnostic where appropriate; stable stringify
  const done = [...blocks.done].map((d) => ({
    time: d.time,
    text: d.text,
    aim_tag: d.aim_tag,
    aims: d.aims ?? []
  }))
  done.sort((a, b) => (a.time + a.text).localeCompare(b.time + b.text))

  const aim_links = [...blocks.aim_links].map((a) => ({ tag: a.tag, note: a.note }))
  aim_links.sort((a, b) => a.tag.localeCompare(b.tag) || a.note.localeCompare(b.note))

  const next = [...blocks.next]

  const reflection = blocks.reflection
  const canonical = { done, aim_links, next, reflection }
  return JSON.stringify(canonical)
}

export function canonicalizeAttachments(
  attachments: NonNullable<ReviewRequest['doc']['attachments']>
): { urisJson: string; maxUpdated: string } {
  const uris = attachments.map((a) => a.uri).sort()
  const maxUpdated = attachments
    .map((a) => a.updated)
    .reduce((max, cur) => (max > cur ? max : cur), '1970-01-01T00:00:00Z')
  return { urisJson: JSON.stringify(uris), maxUpdated }
}

export function sha256(input: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(input).digest('hex')
}

export function computeInputsHash(req: ReviewRequest): string {
  const blocksCanonical = canonicalizeBlocks(req.doc.blocks)
  const att = req.doc.attachments && req.doc.attachments.length > 0
    ? canonicalizeAttachments(req.doc.attachments)
    : { urisJson: '[]', maxUpdated: '1970-01-01T00:00:00Z' }
  return sha256(blocksCanonical + '|' + att.urisJson + '|' + att.maxUpdated)
}

export function ulidLike(): string {
  // Simple sortable id for skeleton purposes (not a real ULID)
  const ts = Date.now().toString(36)
  const rand = crypto.randomBytes(8).toString('hex')
  return `${ts}_${rand}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function gradeAtLeastBMinus(grade: string): boolean {
  // very light comparator: A+ > A > A- > B+ > B > B- > C...
  const order = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F']
  const idx = order.indexOf(grade)
  return idx >= 0 && idx <= order.indexOf('B-')
}

