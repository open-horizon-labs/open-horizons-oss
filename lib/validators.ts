import { DailyFrontMatter, ReviewBlocks } from './graph/types'

export function contextSet(fm: DailyFrontMatter | null): { ok: boolean; error?: string } {
  if (!fm || !fm.activeContextFor || !fm.activeContextFor.trim()) {
    return { ok: false, error: 'oh:active_context_for is missing' }
  }
  return { ok: true }
}

export function presenceBlocks(blocks: ReviewBlocks): { warns: string[] } {
  const warns: string[] = []
  if (!blocks.done || blocks.done.length === 0) warns.push('Done section missing')
  if (!blocks.aims || blocks.aims.length === 0) warns.push('Aims link-backs missing')
  if (!blocks.next || blocks.next.length === 0) warns.push('Next section missing')
  const r = blocks.reflection || {}
  if (!r.win && !r.learning && !r.adjust) warns.push('Reflection section missing')
  return { warns }
}

export function nextCount(blocks: ReviewBlocks): { ok: boolean; warn?: string } {
  const n = (blocks.next || []).length
  if (n < 1 || n > 5) return { ok: false, warn: `Next items should be 1..5 (got ${n})` }
  return { ok: true }
}

export function reflectionTriad(blocks: ReviewBlocks): { ok: boolean; warn?: string } {
  const r = blocks.reflection || {}
  const ok = Boolean((r.win || '').trim()) && Boolean((r.learning || '').trim()) && Boolean((r.adjust || '').trim())
  return ok ? { ok: true } : { ok: false, warn: 'Reflection should cover Win, Learning, Adjust' }
}

// Simple extraction from MD body for MVP (heuristic)
export function extractBlocksFromBody(body: string): ReviewBlocks {
  const section = (name: string) => extractListUnderHeading(body, name)
  const done = section('Done')
  const aims = section('Aims')
  const next = section('Next')
  const reflectionText = extractTextUnderHeading(body, 'Reflection')
  const reflection = parseReflection(reflectionText)
  return { done, aims, next, reflection }
}

function extractListUnderHeading(md: string, heading: string): string[] {
  const rx = new RegExp(`^##\\s*${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?:^##\\s+|\n\n#|$)`, 'm')
  const m = rx.exec(md)
  if (!m) return []
  const block = m[1]
  const out: string[] = []
  for (const line of block.split(/\r?\n/)) {
    const li = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (li) out.push(li[1].trim())
  }
  return out
}

function extractTextUnderHeading(md: string, heading: string): string {
  const rx = new RegExp(`^##\\s*${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?:^##\\s+|\n\n#|$)`, 'm')
  const m = rx.exec(md)
  return m ? m[1].trim() : ''
}

function parseReflection(text: string): ReviewBlocks['reflection'] {
  const r: ReviewBlocks['reflection'] = {}
  const find = (key: string) => new RegExp(`${key}\\s*:\\s*([^\n]+)`, 'i').exec(text)?.[1]?.trim()
  r.win = find('Win')
  r.learning = find('Learning')
  r.adjust = find('Adjust')
  return r
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

