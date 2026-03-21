import { GraphNode } from '../contracts/endeavor-contract'
import { DailyFrontMatter, ReviewBlocks } from '../graph/types'
import { extractBlocksFromBody } from '../validators'
import { ReviewRequest, ReviewResponse } from '../schemas/review'

export type Generated = {
  blocks: { done: string; aims: string; next: string; reflection: string }
  traces: { note: string }[]
}

export function blocksToMarkdown(b: ReviewBlocks): Generated['blocks'] {
  return {
    done: b.done.map((t) => `- ${t}`).join('\n'),
    aims: b.aims.map((t) => `- ${t}`).join('\n'),
    next: b.next.map((t) => `- ${t}`).join('\n'),
    reflection: [
      b.reflection.win ? `Win: ${b.reflection.win}` : null,
      b.reflection.learning ? `Learning: ${b.reflection.learning}` : null,
      b.reflection.adjust ? `Adjust: ${b.reflection.adjust}` : null
    ]
      .filter(Boolean)
      .join('\n')
  }
}

function transformLLMResponse(response: ReviewResponse, activeNode: GraphNode | undefined): Generated {
  const { draft } = response
  
  return {
    blocks: {
      done: draft.highlights.map(h => `- ${h}`).join('\n'),
      aims: draft.aims_advanced.map(a => `- ${a.tag}: ${a.rationale}`).join('\n'),
      next: draft.next_recommendations.map(n => `- ${n}`).join('\n'),
      reflection: [
        draft.summary,
        draft.applied_strengths.length > 0 ? `\nStrengths applied: ${draft.applied_strengths.join(', ')}` : null,
        draft.risks.length > 0 ? `\nRisks to monitor: ${draft.risks.join(', ')}` : null
      ].filter(Boolean).join('\n')
    },
    traces: [
      { note: `run_id=${response.run_id}` },
      { note: `model=${response.provenance.model}` },
      { note: `tokens=${response.metrics.tokens_used}` },
      { note: `latency=${response.metrics.latency_ms}ms` },
      { note: `readability=${response.checks.readability_grade}` }
    ]
  }
}

export async function generateReview(input: {
  body: string
  fm: DailyFrontMatter
  activeNode: GraphNode | undefined
  attachments: { type: string; title: string; uri: string; updated: string; note?: string }[]
  userId?: string
  date?: string
}): Promise<Generated> {
  // Parse blocks from body text
  const blocks = extractBlocksFromBody(input.body)

  // Prepare request for LLM API (profile will be fetched server-side)
  const reviewRequest: ReviewRequest = {
    user: {
      id: input.userId || 'user-1'
    },
    doc: {
      date: input.date || new Date().toISOString().split('T')[0],
      blocks: {
        done: blocks.done.map(text => ({
          time: new Date().toISOString(),
          text,
          aims: blocks.aims.length > 0 ? [blocks.aims[0]] : undefined
        })),
        aim_links: blocks.aims.map(aim => ({ tag: `#${input.activeNode?.node_type}/${input.activeNode?.id}`, note: aim })),
        next: blocks.next,
        reflection: {
          win: blocks.reflection?.win || '',
          learning: blocks.reflection?.learning || '',
          adjust: blocks.reflection?.adjust || ''
        }
      },
      attachments: input.attachments,
      context: {
        tree: input.activeNode?.node_type,
        node: input.activeNode?.id
      }
    }
  }

  try {
    // Call the LLM API
    const response = await fetch('/api/llm/review/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewRequest)
    })

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`)
    }

    const reviewResponse: ReviewResponse = await response.json()
    return transformLLMResponse(reviewResponse, input.activeNode)
    
  } catch (error) {
    // Fallback to heuristic parsing if API call fails
    console.warn('LLM synthesis failed, falling back to heuristic parsing:', error)
    const blocksMd = blocksToMarkdown(blocks)
    return {
      blocks: blocksMd,
      traces: [
        { note: `fallback=heuristic` },
        { note: `error=${error}` },
        { note: `active=${input.fm.activeContextFor}` },
        { note: `nodeType=${input.activeNode?.node_type ?? 'unknown'}` }
      ]
    }
  }
}
