import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth } from '../../../../lib/auth-api'
import { MarkdownAimsImporterImpl } from '../../../../lib/import/importer'
import { ImportOptions } from '../../../../lib/import/types'

export const POST = withSimpleAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { markdown, content, contextId, options = {} } = body

    // Accept either 'markdown' or 'content' field name for flexibility
    const markdownContent = markdown || content

    if (!markdownContent || typeof markdownContent !== 'string') {
      return NextResponse.json(
        { error: 'Markdown content is required' },
        { status: 400 }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Create importer
    const importer = new MarkdownAimsImporterImpl(openaiApiKey)

    // Build import options
    const importOptions: ImportOptions = {
      user_id: user.id,
      dry_run: options.dry_run ?? true, // Default to dry run
      source_uri: options.source_uri,
      upsert_policy: {
        merge_titles: options.merge_titles ?? true,
        overwrite_outcome: options.overwrite_outcome ?? false,
        auto_link: options.auto_link ?? false,
        similarity_threshold: {
          update: options.similarity_threshold?.update ?? 0.87,
          review_band: options.similarity_threshold?.review_band ?? 0.78
        }
      }
    }

    // Parse markdown to get plan
    const plan = await importer.parseMarkdown(markdownContent)

    return NextResponse.json({
      success: true,
      plan: plan,
      report: null  // No report for preview, only for commit
    })

  } catch (error) {
    console.error('Import API error:', error)
    return NextResponse.json(
      {
        error: 'Import failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
})

// Handle dry-run preview requests
export const GET = withSimpleAuth(async (request: NextRequest, user) => {
  const { searchParams } = new URL(request.url)
  const markdown = searchParams.get('markdown')

  if (!markdown) {
    return NextResponse.json(
      { error: 'Markdown parameter required for preview' },
      { status: 400 }
    )
  }

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const importer = new MarkdownAimsImporterImpl(openaiApiKey)

    const importOptions: ImportOptions = {
      user_id: user.id,
      dry_run: true
    }

    const plan = await importer.parseMarkdown(markdown)

    return NextResponse.json({
      success: true,
      plan: plan,
      report: null
    })

  } catch (error) {
    console.error('Preview API error:', error)
    return NextResponse.json(
      {
        error: 'Preview failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
})