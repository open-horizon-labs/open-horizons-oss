interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMRequest {
  messages: Message[]
  max_tokens?: number
  temperature?: number
  prompt_cache_key?: string
}

interface LLMResponse {
  content: string
  tokens_used: number
  cached_tokens?: number
}

export async function callLLM({ messages, max_tokens = 4000, temperature = 0.3, prompt_cache_key }: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5-nano'
  const allowedEfforts = new Set(['minimal', 'low', 'medium', 'high'])
  const envEffort = (process.env.OPENAI_REASONING_EFFORT || 'minimal').toLowerCase()
  const reasoningEffort = allowedEfforts.has(envEffort) ? envEffort : 'minimal'

  // Use Responses API format with input parameter instead of messages
  const payload: any = {
    model,
    input: messages,
    max_output_tokens: max_tokens,
    reasoning: {
      effort: reasoningEffort
    }
  }

  // Only add temperature for models that support it (not o1/reasoning models)
  if (!model.includes('o1') && !model.includes('gpt-5')) {
    payload.temperature = temperature
  }

  // Add prompt cache key if provided (for caching optimization)
  if (prompt_cache_key) {
    payload.prompt_cache_key = prompt_cache_key
  }

  console.log('[LLM Client] Making request with:', { 
    model, 
    max_output_tokens: max_tokens, 
    temperature_requested: temperature,
    temperature_in_payload: payload.temperature,
    reasoningEffort,
    messages_count: messages.length,
    prompt_cache_key 
  })

  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  console.log('[LLM Client] Response status:', resp.status)

  if (!resp.ok) {
    const errorText = await resp.text()
    console.error('[LLM Client] Error response:', errorText)
    throw new Error(`OpenAI HTTP ${resp.status}: ${errorText}`)
  }

  const data = await resp.json()
  
  // Write response to temp file for debugging (since console output gets truncated)
  try {
    const fs = require('fs')
    fs.writeFileSync('/tmp/openai-response.json', JSON.stringify(data, null, 2))
    console.log('[LLM Client] OpenAI response written to /tmp/openai-response.json')
  } catch (e) {
    console.log('[LLM Client] Could not write debug file:', e instanceof Error ? e.message : e)
  }
  
  // Support both responses API and chat completions response formats
  // Responses API format for reasoning models: find first text or message content
  let content = ''
  if (data.output && Array.isArray(data.output)) {
    for (const outputItem of data.output) {
      if (outputItem.type === 'message' && outputItem.content && Array.isArray(outputItem.content)) {
        // For message type, look for output_text content within the content array
        for (const contentItem of outputItem.content) {
          if (contentItem.type === 'output_text' && contentItem.text) {
            content = contentItem.text
            break
          }
        }
      } else if (outputItem.content && Array.isArray(outputItem.content)) {
        // For other types like reasoning, check for direct text content
        for (const contentItem of outputItem.content) {
          if (contentItem.type === 'text' && contentItem.text) {
            content = contentItem.text
            break
          }
        }
      }
      if (content) break
    }
  }
  
  // Fallback to legacy formats
  if (!content) {
    content = 
      data.choices?.[0]?.message?.content ||
      (typeof data.output_text === 'string' && data.output_text) ||
      ''
  }
  
  console.log('[LLM Client] Extracted content:', content ? content.substring(0, 100) + '...' : 'NO CONTENT')
  console.log('[LLM Client] EXTRACTION DEBUG: Found content items:')
  if (data.output && Array.isArray(data.output)) {
    data.output.forEach((outputItem: any, i: number) => {
      console.log(`[LLM Client] Output[${i}] type: ${outputItem.type}, content array length: ${outputItem.content?.length}`)
      if (outputItem.content && Array.isArray(outputItem.content)) {
        outputItem.content.forEach((contentItem: any, j: number) => {
          console.log(`[LLM Client] Content[${i}][${j}] type: ${contentItem.type}, has text: ${!!contentItem.text}`)
          if (contentItem.text) {
            console.log(`[LLM Client] Content[${i}][${j}] text preview: "${contentItem.text.substring(0, 100)}..."`)
          }
        })
      }
    })
  }
  console.log('[LLM Client] Raw response structure:', {
    hasChoices: !!data.choices,
    hasOutput: !!data.output,
    outputLength: data.output?.length,
    outputTypes: data.output?.map((o: any) => ({ type: o.type, hasContent: !!o.content })),
  })
  
  // Additional debugging for content extraction
  if (data.output && Array.isArray(data.output) && !content) {
    console.log('[LLM Client] Debug: Full output structure:')
    data.output.forEach((outputItem: any, i: number) => {
      console.log(`[LLM Client] Output[${i}]:`, {
        type: outputItem.type,
        hasContent: !!outputItem.content,
        contentLength: outputItem.content?.length,
        contentTypes: outputItem.content?.map((c: any) => ({ type: c.type, hasText: !!c.text }))
      })
      if (outputItem.content && Array.isArray(outputItem.content)) {
        outputItem.content.forEach((contentItem: any, j: number) => {
          console.log(`[LLM Client] Content[${i}][${j}]:`, {
            type: contentItem.type,
            hasText: !!contentItem.text,
            hasContent: !!contentItem.content,
            hasMessage: !!contentItem.message,
            allKeys: Object.keys(contentItem),
            textPreview: contentItem.text ? contentItem.text.substring(0, 50) + '...' : 'NO TEXT',
            contentPreview: contentItem.content ? (typeof contentItem.content === 'string' ? contentItem.content.substring(0, 50) + '...' : 'OBJECT_CONTENT') : 'NO CONTENT',
            messagePreview: contentItem.message ? (typeof contentItem.message === 'string' ? contentItem.message.substring(0, 50) + '...' : 'OBJECT_MESSAGE') : 'NO MESSAGE'
          })
        })
      }
    })
  }

  const tokens_used = 
    data.usage?.total_tokens ||
    ((data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)) ||
    0

  const cached_tokens = data.usage?.prompt_tokens_details?.cached_tokens || 0

  console.log('[LLM Client] Success: tokens used:', tokens_used, 'cached:', cached_tokens)

  // Check for incomplete response
  if (data.status === 'incomplete') {
    const reason = data.incomplete_details?.reason || 'unknown'
    throw new Error(`OpenAI response incomplete: ${reason}. Try increasing max_tokens or reducing reasoning effort.`)
  }

  if (!content) {
    throw new Error('No content returned from OpenAI')
  }

  return { content, tokens_used, cached_tokens }
}