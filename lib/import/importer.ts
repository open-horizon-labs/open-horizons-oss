import {
  MarkdownAimsImporter,
  ImportOptions,
  UpsertPlan,
  ImportReport,
  UpsertAction,
  ImportEndeavor
} from './types'
import { supabaseServer } from '../supabaseServer'
import { createHash } from 'crypto'

/**
 * Simple markdown aims importer - ONE OpenAI call only
 */
export class MarkdownAimsImporterImpl implements MarkdownAimsImporter {
  private apiKey: string
  private openaiBaseUrl: string
  private currentMarkdown: string = ''

  constructor(openaiApiKey: string, openaiBaseUrl?: string) {
    this.apiKey = openaiApiKey
    this.openaiBaseUrl = openaiBaseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com'
  }

  async parseMarkdown(markdown: string): Promise<UpsertPlan> {
    this.currentMarkdown = markdown
    const sourceHash = createHash('md5').update(markdown).digest('hex')

    console.log('📝 Starting markdown parsing with single LLM call')

    const llmResult = await this.parseMarkdownWithLLM()
    const endeavors = llmResult.endeavors || []
    console.log(`Processing ${endeavors.length} endeavors`)

    // Create upsert actions - each endeavor already has its node_type from the LLM
    const actions: UpsertAction[] = endeavors.map((endeavor: any) => ({
      action: 'INSERT' as const,
      endeavor: {
        id: `${endeavor.type}.${this.titleToSlug(endeavor.title)}`,
        slug: this.titleToSlug(endeavor.title),
        title: endeavor.title,
        summary: endeavor.summary,
        node_type: endeavor.type,
        provenance: {
          source_uri: 'markdown-import',
          imported_at: new Date().toISOString(),
          by: 'system', // will be overridden by the caller
          hash: sourceHash
        }
      }
    }))

    return {
      actions,
      edges: [],
      warnings: []
    }
  }

  private async parseMarkdownWithLLM(): Promise<any> {
    const systemPrompt = `Parse this Open Horizons markdown into structured endeavors. Return valid JSON.

Each endeavor needs:
- title: clear, actionable name
- summary: concise description
- type: one of "mission", "aim", "initiative", "task", "ritual", "strength", "achievement"

Return JSON in this format:
{
  "endeavors": [
    {
      "title": "string",
      "summary": "string",
      "type": "mission|aim|initiative|task|ritual|strength|achievement"
    }
  ]
}`

    const fullInput = `${systemPrompt}

Markdown:
${this.currentMarkdown}`

    const response = await fetch(`${this.openaiBaseUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Host': 'api.openai.com'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-nano',
        input: fullInput,
        max_output_tokens: 32000,
        text: {
          format: {
            type: "json_schema",
            name: "endeavor_parsing_schema",
            strict: true,
            schema: {
              type: "object",
              properties: {
                endeavors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      summary: { type: "string" },
                      type: { type: "string", enum: ["mission", "aim", "initiative", "task", "ritual", "strength", "achievement"] }
                    },
                    required: ["title", "summary", "type"],
                    additionalProperties: false
                  }
                }
              },
              required: ["endeavors"],
              additionalProperties: false
            }
          }
        }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const result = await response.json()
    const content = result.text
    console.log('📋 LLM parsing result:', content)

    return JSON.parse(content)
  }

  async commitPlan(plan: UpsertPlan, userId: string): Promise<ImportReport> {
    console.log('💾 Committing import plan to database')

    const supabase = await supabaseServer()
    const startTime = Date.now()

    try {
      // Simple: just insert all endeavors into the endeavors table
      const endeavorsToInsert = plan.actions.map(action => ({
        id: action.endeavor.id,
        title: action.endeavor.title,
        description: action.endeavor.summary,
        node_type: action.endeavor.node_type,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { data, error } = await supabase
        .from('endeavors')
        .insert(endeavorsToInsert)
        .select('id')

      if (error) {
        console.error('Database insert error:', error)
        throw error
      }

      console.log(`✅ Successfully inserted ${data?.length || 0} endeavors`)

      return {
        summary: {
          total_sections: 1,
          created: data?.length || 0,
          updated: 0,
          unchanged: 0,
          review_required: 0,
          failed: 0
        },
        actions: plan.actions,
        edges_added: 0,
        warnings: plan.warnings,
        errors: [],
        processing_time_ms: Date.now() - startTime
      }

    } catch (error) {
      console.error('Import commit failed:', error)

      return {
        summary: {
          total_sections: 1,
          created: 0,
          updated: 0,
          unchanged: 0,
          review_required: 0,
          failed: plan.actions.length
        },
        actions: plan.actions,
        edges_added: 0,
        warnings: plan.warnings,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processing_time_ms: Date.now() - startTime
      }
    }
  }

  private titleToSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }
}