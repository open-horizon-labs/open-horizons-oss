import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '../../../../lib/auth-api'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)

    if (!authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: authResult.user,
      authMethod: authResult.authMethod
    })
  } catch (error) {
    console.error('Auth user API error:', error)
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    )
  }
}