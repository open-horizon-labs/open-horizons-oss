import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth } from '../../../../../lib/auth-api'
import { MarkdownAimsImporterImpl } from '../../../../../lib/import/importer'
import { ImportOptions, UpsertPlan } from '../../../../../lib/import/types'

export const POST = withSimpleAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { plan, options = {} } = body

    if (!plan) {
      return NextResponse.json(
        { error: 'Import plan is required' },
        { status: 400 }
      )
    }

    // Validate plan structure
    if (!plan.actions || !Array.isArray(plan.actions)) {
      return NextResponse.json(
        { error: 'Invalid plan structure: actions array required' },
        { status: 400 }
      )
    }

    // Check for validation errors that would block execution
    if (plan.validation_errors && plan.validation_errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot commit plan with validation errors',
          validation_errors: plan.validation_errors 
        },
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

    // Build import options for execution
    const importOptions: ImportOptions = {
      user_id: user.id,
      dry_run: false, // Execute for real
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

    // Execute the import plan
    const report = await importer.commitPlan(plan as UpsertPlan, user.id)

    return NextResponse.json({
      success: true,
      summary: report.summary,
      report
    })

  } catch (error) {
    console.error('Import commit API error:', error)
    return NextResponse.json(
      {
        error: 'Import commit failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
})