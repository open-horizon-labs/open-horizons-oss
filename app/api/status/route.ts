import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { query } from '../../../lib/db'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod) => {
  try {
    const endeavors = await query('SELECT COUNT(*) as count FROM endeavors')
    const contexts = await query('SELECT COUNT(*) as count FROM contexts')

    return Response.json({
      timestamp: new Date().toISOString(),
      database: {
        endeavors_count: parseInt(endeavors[0]?.count || '0'),
        contexts_count: parseInt(contexts[0]?.count || '0'),
      },
      user: {
        id: user.id,
        email: user.email,
      },
      environment: process.env.NODE_ENV
    })
  } catch (error) {
    return Response.json({
      error: 'Status check failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
})
