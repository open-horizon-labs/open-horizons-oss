import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  return NextResponse.json(
    { error: 'Markdown import requires OPENAI_API_KEY configuration. See .env.example.' },
    { status: 501 }
  )
})
