// Test the OpenAI API calls in isolation
// Mock fetch to capture API calls without hitting Supabase
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock Supabase to avoid request context issues
jest.mock('../../supabaseServer', () => ({
  supabaseServer: jest.fn(() => Promise.resolve({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    })
  }))
}))

// Directly test the LLM parsing method
describe('OpenAI API Compliance', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  class TestImporter {
    private apiKey: string
    private currentMarkdown: string = ''

    constructor(apiKey: string) {
      this.apiKey = apiKey
    }

    setMarkdown(markdown: string) {
      this.currentMarkdown = markdown
    }

    async parseMarkdownWithLLM(): Promise<any[]> {
      // This is the current implementation from importer.ts
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-5-nano',
          messages: [
            {
              role: 'system',
              content: `Parse this Open Horizons markdown into structured endeavors with relationships. Return valid JSON array only.

Each endeavor should have:
- title: meaningful title
- summary: brief description (max 220 chars)
- role: mission|aim|initiative|strength|achievement|task|ritual
- horizon: quarter|year|3-5y (if applicable)
- confidence: 0.0-1.0
- supports: array of endeavor titles this supports (e.g., aims support mission, initiatives support aims)
- enables: array of endeavor titles this enables (e.g., strengths enable various endeavors)

Identify hierarchical relationships:
- Aims typically support the Mission
- Initiatives typically support specific Aims
- Tasks typically support Initiatives
- Strengths enable Mission/Aims
- Achievements relate to past successes

Return JSON array of endeavors with relationship fields.`
            },
            {
              role: 'user',
              content: `Parse the markdown content in this JSON string: ${JSON.stringify(this.currentMarkdown)}`
            }
          ],
          temperature: 0.1,
          max_tokens: 4000
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content || ''
      const cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim()

      try {
        return JSON.parse(cleanedContent)
      } catch (error) {
        throw new Error(`Failed to parse LLM response as JSON: ${cleanedContent}`)
      }
    }
  }

  it('should currently use Chat Completions API (before migration)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '[]' } }]
      })
    })

    const importer = new TestImporter('test-api-key')
    importer.setMarkdown('# Test Mission')
    await importer.parseMarkdownWithLLM()

    // Current implementation uses Chat Completions
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.any(Object)
    )
  })

  it('should use deprecated payload structure that causes Bad Request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '[]' } }]
      })
    })

    const importer = new TestImporter('test-api-key')
    importer.setMarkdown('# Test Mission')
    await importer.parseMarkdownWithLLM()

    const [, requestOptions] = mockFetch.mock.calls[0]
    const payload = JSON.parse(requestOptions.body)

    // Current implementation uses deprecated structure
    expect(payload).toHaveProperty('messages') // Chat Completions format
    expect(payload).toHaveProperty('temperature') // No longer supported
    expect(payload).not.toHaveProperty('input') // Should use this for Responses API
  })

  it('should migrate to use Responses API endpoint', async () => {
    // This test shows what the corrected implementation should look like
    class CorrectedImporter {
      private apiKey: string
      private currentMarkdown: string = ''

      constructor(apiKey: string) {
        this.apiKey = apiKey
      }

      setMarkdown(markdown: string) {
        this.currentMarkdown = markdown
      }

      async parseMarkdownWithLLM(): Promise<any[]> {
        // Updated implementation using Responses API
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-5-nano',
            input: `Parse this Open Horizons markdown into structured endeavors with relationships. Return valid JSON array only.

Each endeavor should have:
- title: meaningful title
- summary: brief description (max 220 chars)
- role: mission|aim|initiative|strength|achievement|task|ritual
- horizon: quarter|year|3-5y (if applicable)
- confidence: 0.0-1.0
- supports: array of endeavor titles this supports (e.g., aims support mission, initiatives support aims)
- enables: array of endeavor titles this enables (e.g., strengths enable various endeavors)

Identify hierarchical relationships:
- Aims typically support the Mission
- Initiatives typically support specific Aims
- Tasks typically support Initiatives
- Strengths enable Mission/Aims
- Achievements relate to past successes

Return JSON array of endeavors with relationship fields.

Parse the markdown content in this JSON string: ${JSON.stringify(this.currentMarkdown)}`,
            max_output_tokens: 4000
          })
        })

        if (!response.ok) {
          throw new Error(`OpenAI error: ${response.statusText}`)
        }

        const data = await response.json()

        // Extract content from Responses API format
        let content = ''
        if (data.output && Array.isArray(data.output)) {
          for (const outputItem of data.output) {
            if (outputItem.type === 'message' && outputItem.content && Array.isArray(outputItem.content)) {
              for (const contentItem of outputItem.content) {
                if (contentItem.type === 'output_text' && contentItem.text) {
                  content = contentItem.text
                  break
                }
              }
            }
            if (content) break
          }
        }

        // Fallback to output_text for simpler responses
        if (!content) {
          content = data.output_text || ''
        }

        const cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim()

        try {
          return JSON.parse(cleanedContent)
        } catch (error) {
          throw new Error(`Failed to parse LLM response as JSON: ${cleanedContent}`)
        }
      }
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        output_text: '[]'
      })
    })

    const correctedImporter = new CorrectedImporter('test-api-key')
    correctedImporter.setMarkdown('# Test Mission')
    await correctedImporter.parseMarkdownWithLLM()

    // Should use Responses API
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.any(Object)
    )

    const [, requestOptions] = mockFetch.mock.calls[0]
    const payload = JSON.parse(requestOptions.body)

    // Should use new payload structure
    expect(payload).toHaveProperty('input')
    expect(payload).toHaveProperty('model')
    expect(payload).toHaveProperty('max_output_tokens')
    expect(payload).not.toHaveProperty('messages')
    expect(payload).not.toHaveProperty('temperature')
    expect(payload).not.toHaveProperty('max_tokens')
  })

  it('should handle complex response format correctly', async () => {
    // Test with more realistic Responses API output format
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: '[{"title":"Test Mission","role":"mission","summary":"A test mission","confidence":0.9}]'
              }
            ]
          }
        ]
      })
    })

    class TestResponseParser {
      private apiKey: string

      constructor(apiKey: string) {
        this.apiKey = apiKey
      }

      async parseWithResponsesAPI(): Promise<any[]> {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-5-nano',
            input: 'Parse test markdown',
            max_output_tokens: 4000
          })
        })

        const data = await response.json()

        // Extract content properly from complex response format
        let content = ''
        if (data.output && Array.isArray(data.output)) {
          for (const outputItem of data.output) {
            if (outputItem.type === 'message' && outputItem.content && Array.isArray(outputItem.content)) {
              for (const contentItem of outputItem.content) {
                if (contentItem.type === 'output_text' && contentItem.text) {
                  content = contentItem.text
                  break
                }
              }
            }
            if (content) break
          }
        }

        if (!content && data.output_text) {
          content = data.output_text
        }

        return JSON.parse(content)
      }
    }

    const parser = new TestResponseParser('test-key')
    const result = await parser.parseWithResponsesAPI()

    expect(result).toEqual([{
      title: 'Test Mission',
      role: 'mission',
      summary: 'A test mission',
      confidence: 0.9
    }])
  })

  it('should support prompt caching when cache key provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ output_text: '[]' })
    })

    class CachedImporter {
      private apiKey: string

      constructor(apiKey: string) {
        this.apiKey = apiKey
      }

      async parseWithCaching(cacheKey?: string): Promise<any[]> {
        const payload: any = {
          model: 'gpt-5-nano',
          input: 'Parse test content',
          max_output_tokens: 4000
        }

        // Add prompt cache key if provided
        if (cacheKey) {
          payload.prompt_cache_key = cacheKey
        }

        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        const data = await response.json()
        return JSON.parse(data.output_text || '[]')
      }
    }

    const importer = new CachedImporter('test-key')
    await importer.parseWithCaching('system-prompt-v1')

    const [, requestOptions] = mockFetch.mock.calls[0]
    const payload = JSON.parse(requestOptions.body)

    expect(payload).toHaveProperty('prompt_cache_key', 'system-prompt-v1')
  })
})