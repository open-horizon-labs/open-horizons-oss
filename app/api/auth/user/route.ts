import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '../../../../lib/auth-api'

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  return NextResponse.json({
    user: authResult.user,
    authMethod: authResult.authMethod
  })
}
