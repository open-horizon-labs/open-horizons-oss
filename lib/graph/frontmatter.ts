import { DailyFrontMatter } from './types'

// Very lightweight YAML-like front-matter parser/serializer for MVP
// Supports keys: id, rdf:type, oh:active_context_for, oh:references (array)

export function parseFrontMatter(md: string): { fm: DailyFrontMatter | null; body: string } {
  const trimmed = md.trimStart()
  if (!trimmed.startsWith('---')) {
    return { fm: null, body: md }
  }
  const endIdx = trimmed.indexOf('\n---', 3)
  if (endIdx === -1) {
    return { fm: null, body: md }
  }
  const header = trimmed.slice(3, endIdx).trim() // after first '---' up to '\n---'
  const rest = trimmed.slice(endIdx + 4) // skip end marker and newline

  let id = ''
  let nodeType: any = 'DailyPage'
  let activeContextFor = ''
  let references: string[] | undefined

  const lines = header.split(/\r?\n/)
  for (const line of lines) {
    const m = /^([A-Za-z0-9_:\-]+)\s*:\s*(.*)$/.exec(line)
    if (!m) continue
    const key = m[1].trim()
    let value = m[2].trim()
    if (key === 'id') id = stripQuotes(value)
    else if (key === 'rdf:type') nodeType = stripQuotes(value) || 'DailyPage'
    else if (key === 'oh:active_context_for') activeContextFor = stripQuotes(value)
    else if (key === 'oh:references') {
      // [a, b, c] or a single string
      if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1)
        references = inner
          .split(',')
          .map((s) => stripQuotes(s.trim()))
          .filter(Boolean)
      } else {
        const single = stripQuotes(value)
        references = single ? [single] : []
      }
    }
  }

  const fm: DailyFrontMatter | null = id || activeContextFor
    ? { id: id || inferDailyIdFromBody(rest), node_type: nodeType, activeContextFor, references }
    : null

  return { fm, body: rest.replace(/^\n+/, '') }
}

export function serializeFrontMatter(fm: DailyFrontMatter, body: string): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`id: ${fm.id}`)
  lines.push(`rdf:type: ${fm.node_type}`)
  lines.push(`oh:active_context_for: ${fm.activeContextFor}`)
  if (fm.references && fm.references.length > 0) {
    const refs = fm.references.map((r) => JSON.stringify(r)).join(', ')
    lines.push(`oh:references: [${refs}]`)
  }
  lines.push('---')
  const header = lines.join('\n')
  const bodyClean = body.replace(/^\n+/, '')
  return header + '\n\n' + bodyClean
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}

function inferDailyIdFromBody(body: string): string {
  // Attempt to find a heading like '# 2025-09-11' -> daily.2025-09-11
  const m = /^#\s*(\d{4}-\d{2}-\d{2})/m.exec(body)
  return m ? `daily.${m[1]}` : 'daily.unknown'
}

