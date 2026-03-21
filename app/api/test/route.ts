import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  console.log('[Test API] POST request received')
  return NextResponse.json({ message: 'Test API works!' })
}