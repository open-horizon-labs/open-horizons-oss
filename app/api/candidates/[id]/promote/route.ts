import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { queryOne, executeReturning } from '../../../../../lib/db'
import { getClient } from '../../../../../lib/db'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const client = await getClient()

  try {
    await client.query('BEGIN')

    const candidateResult = await client.query(
      'SELECT id, endeavor_id, type, content, status FROM candidates WHERE id = $1',
      [id]
    )
    const candidate = candidateResult.rows[0]

    if (!candidate) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (candidate.status !== 'pending') {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: `Candidate is already ${candidate.status}` }, { status: 400 })
    }

    let promoted: any

    if (candidate.type === 'guardrail') {
      const result = await client.query(
        'INSERT INTO guardrails (endeavor_id, content) VALUES ($1, $2) RETURNING id, endeavor_id, content, created_at, updated_at',
        [candidate.endeavor_id, candidate.content]
      )
      promoted = result.rows[0]
    } else {
      // Default to metis
      const result = await client.query(
        'INSERT INTO metis_entries (endeavor_id, content, type) VALUES ($1, $2, $3) RETURNING id, endeavor_id, content, type, created_at, updated_at',
        [candidate.endeavor_id, candidate.content, 'pattern']
      )
      promoted = result.rows[0]
    }

    await client.query(
      "UPDATE candidates SET status = 'promoted', promoted_to_id = $1 WHERE id = $2",
      [promoted.id, id]
    )

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      promoted_to: candidate.type === 'guardrail' ? 'guardrail' : 'metis',
      promoted_id: promoted.id,
      candidate_id: id,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Promote candidate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    client.release()
  }
})
