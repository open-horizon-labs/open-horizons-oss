import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { callLLM } from '../../../../lib/llm/client'
import { buildContextData, generateCacheKey } from '../../../../lib/llm/contextBuilder'
import { DatabaseNodeType } from '../../../../lib/contracts/endeavor-contract'

export const dynamic = 'force-dynamic'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  date: string
  context_id: string
  prompt: string
  mode?: 'aim' | 'do' | 'reflect' // Mode-aware time filtering
  conversation_history?: ChatMessage[] // For multi-turn support
  max_tokens?: number
  temperature?: number
  daily_note_body?: string
  context_node?: {
    id: string
    title?: string
    description?: string
    node_type?: string
    tags?: string[]
    status?: string
    roles?: any[]
    practices?: string
    frequency?: string
    metadata?: Record<string, any>
  }
  context_hierarchy?: {
    id: string
    title?: string
    description?: string
    node_type?: string
    tags?: string[]
    status?: string
    roles?: any[]
    practices?: string
    frequency?: string
    metadata?: Record<string, any>
  }[]
  hierarchical_notes?: {
    context_id: string
    context_title: string
    context_type: string
    daily_notes: string
  }[]
}

interface ChatResponse {
  response: string
  metrics: {
    tokens_used: number
    latency_ms: number
    cached_tokens?: number
  }
  context_included: {
    daily_note: string
    context_hierarchy: string[]
  }
}

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  console.log('[Chat API] POST request started')
  const started = Date.now()

  let body: any
  try {
    console.log('[Chat API] Parsing request body')
    body = await req.json()
    console.log('[Chat API] Request body parsed successfully, keys:', Object.keys(body))
  } catch (error) {
    console.error('[Chat API] JSON parsing error:', error)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    date,
    context_id,
    prompt,
    mode = 'do', // Default to 'do' mode if not specified
    conversation_history = [],
    max_tokens = 4000,
    temperature = 0.7,
    daily_note_body,
    context_node,
    context_hierarchy,
    hierarchical_notes
  }: ChatRequest = body

  if (!date || !context_id || !prompt) {
    return NextResponse.json({
      error: 'Missing required fields: date, context_id, prompt'
    }, { status: 400 })
  }

  try {
    // 🚨 Mode-aware time filtering for logs
    const daysBack = mode === 'do' ? 1 : 7 // "do" = 1 day, "aim"/"reflect" = 7 days
    const startDate = new Date(date)
    startDate.setDate(startDate.getDate() - daysBack)
    const startDateStr = startDate.toISOString().split('T')[0]

    // Collect all entity IDs from hierarchy (always include ancestors and descendants)
    const hierarchyIds = context_hierarchy?.map(node => node.id) || [context_id]
    if (!hierarchyIds.includes(context_id)) {
      hierarchyIds.push(context_id)
    }

    console.log('[Chat API] Fetching logs with mode-aware filtering:', {
      mode,
      daysBack,
      startDate: startDateStr,
      endDate: date,
      hierarchyIds: hierarchyIds.length
    })

    // Query logs table with time filter for all hierarchy entities
    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { data: logs, error: logsError } = await supabase
      .from('logs')
      .select('*')
      .eq('entity_type', 'endeavor')
      .in('entity_id', hierarchyIds)
      .gte('log_date', startDateStr)
      .lte('log_date', date)
      .order('log_date', { ascending: false })

    if (logsError) {
      console.error('[Chat API] Error fetching logs:', logsError)
      // Continue with empty logs rather than failing
    }

    console.log('[Chat API] Fetched logs:', logs?.length || 0, 'entries')

    // Transform logs into hierarchical_notes format for buildContextData
    const filteredNotes = hierarchyIds.map(entityId => {
      const entityLogs = logs?.filter(log => log.entity_id === entityId) || []
      const nodeInfo = context_hierarchy?.find(node => node.id === entityId)

      // Combine all log entries for this entity
      const combinedContent = entityLogs
        .map(log => log.content)
        .join('\n\n')

      return {
        context_id: entityId,
        context_title: nodeInfo?.title || entityId,
        context_type: nodeInfo?.node_type || DatabaseNodeType.enum.Task,
        daily_notes: combinedContent
      }
    }).filter(note => note.daily_notes.trim().length > 0)

    console.log('[Chat API] Transformed logs into notes:', filteredNotes.length, 'contexts with content')

    // Build structured context data using utility function with filtered logs
    const contextData = buildContextData({
      user_id: user.id,
      date,
      context_id,
      daily_note_body,
      context_node,
      context_hierarchy,
      hierarchical_notes: filteredNotes // Use filtered logs instead of client-provided notes
    })

    // Generate cache key for optimal caching
    const promptCacheKey = generateCacheKey(contextData)
    
    // Clean system prompt with JSON context data
    const systemMessage = {
      role: 'system' as const,
      content: `You are an AI assistant specialized in helping with daily reflection and work planning within the Open Horizons personal growth system.

# SYSTEM OVERVIEW
Open Horizons is built around adaptive rituals following the pattern: Aim → Do → Reflect. You are assisting users with their Daily Review ritual, organizing work hierarchically through Missions → Aims → Initiatives → Tasks.

# CONTEXT DATA
The complete context for this session is provided below as structured JSON:

\`\`\`json
${JSON.stringify(contextData, null, 2)}
\`\`\`

# KEY INSTRUCTIONS
1. **Current Focus**: The user is working in "${contextData.current_context.title}" (${contextData.current_context.type}). References to "this task/project/work" mean the current_context.

2. **Full Hierarchy**: The hierarchy_full array contains the complete upward path from root to current, with full context details and daily notes for ${contextData.date} where they exist.

3. **Daily Notes**: Focus on daily_notes fields in both current_context and hierarchy_full which contain specific progress and reflections for today.

4. **Context Relationships**: Each hierarchy level shows how the current work connects to larger aims and missions through the parent/child hierarchy.

5. **Growth Mindset**: Help users reflect on accomplishments, identify learnings, plan next steps, and connect daily work to larger aims.

Please respond based on this structured context, being contextual, actionable, encouraging, and concise.`
    }
    
    const userMessage = {
      role: 'user' as const,
      content: prompt
    }
    
    // Build complete messages array including conversation history
    const messages = [
      systemMessage,
      ...conversation_history, // Include previous conversation
      userMessage
    ]

    // Call LLM using shared client with messages format
    let response_text = ''
    let tokens_used = 0
    let cached_tokens = 0

    try {
      console.log('[Chat API] Calling LLM with messages:', messages.length, 'messages')
      console.log('[Chat API] System message length:', systemMessage.content.length)
      console.log('[Chat API] Full messages payload:', JSON.stringify(messages, null, 2))
      console.log('[Chat API] LLM params:', { max_tokens, temperature, promptCacheKey })
      
      const result = await callLLM({
        messages,
        max_tokens,
        temperature,
        prompt_cache_key: promptCacheKey
      })
      response_text = result.content
      tokens_used = result.tokens_used
      cached_tokens = result.cached_tokens || 0
      console.log('[Chat API] LLM success, tokens used:', tokens_used, 'cached:', cached_tokens)
    } catch (error: any) {
      console.error('[Chat API] LLM error:', error)
      console.error('[Chat API] LLM error stack:', error.stack)
      console.error('[Chat API] LLM error details:', {
        name: error.name,
        message: error.message,
        cause: error.cause
      })
      response_text = `Error calling LLM: ${error.message}`
    }

    const chatResponse: ChatResponse = {
      response: response_text,
      metrics: {
        tokens_used,
        latency_ms: Date.now() - started,
        cached_tokens
      },
      context_included: {
        daily_note: JSON.stringify(contextData, null, 2),
        context_hierarchy: contextData.hierarchy_full.length > 0 ? 
          contextData.hierarchy_full.map(node => `${node.title} (${node.type})`) :
          ['No hierarchy available']
      }
    }

    return NextResponse.json(chatResponse, { status: 200 })

  } catch (error: any) {
    console.error('[Chat API] Server error:', error)
    console.error('[Chat API] Error stack:', error.stack)
    console.error('[Chat API] Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause
    })
    return NextResponse.json({ 
      error: `Server error: ${error.message}` 
    }, { status: 500 })
  }
})