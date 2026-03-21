import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { query, queryOne } from '../../../lib/db'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    const contexts = await query(
      'SELECT id, title, description, created_at, updated_at FROM contexts ORDER BY created_at ASC'
    )

    return NextResponse.json({
      contexts: contexts.map(c => ({
        ...c,
        is_owner: true
      })),
      count: contexts.length
    })
  } catch (error) {
    console.error('Error fetching contexts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contexts' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    const { title, description } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const contextId = `context:${Date.now()}`

    await query(
      'INSERT INTO contexts (id, title, description) VALUES ($1, $2, $3)',
      [contextId, title, description || '']
    )

    return NextResponse.json({
      success: true,
      contextId
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating context:', error)
    return NextResponse.json(
      { error: 'Failed to create context' },
      { status: 500 }
    )
  }
})
