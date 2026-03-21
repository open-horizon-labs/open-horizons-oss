import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { getUserContexts } from '../../../lib/contexts/context-operations'

export const POST = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    console.log('\n🧪 TESTING MODIFIED getUserContexts FUNCTION')

    const acceptedUserId = "ed63c85c-50b2-4226-aa63-458bb1e2d5f8"
    const expectedContextId = "context:fc249f8a-92d1-46b7-855f-eb39285e774b:1758233820278"

    console.log('Testing getUserContexts for user:', acceptedUserId)
    console.log('Expecting to find context:', expectedContextId)

    const userContexts = await getUserContexts(acceptedUserId)

    console.log(`✅ getUserContexts returned: ${userContexts.length} contexts`)
    userContexts.forEach(ctx => {
      console.log(`  - ${ctx.id}: "${ctx.title}"`)
    })

    const foundExpectedContext = userContexts.find(ctx => ctx.id === expectedContextId)

    if (foundExpectedContext) {
      console.log(`🎉 SUCCESS! Found expected context: "${foundExpectedContext.title}"`)
    } else {
      console.log('❌ Expected context not found')
    }

    return NextResponse.json({
      success: !!foundExpectedContext,
      contextsFound: userContexts.length,
      expectedContextFound: !!foundExpectedContext,
      contexts: userContexts.map(ctx => ({
        id: ctx.id,
        title: ctx.title
      })),
      expectedContext: foundExpectedContext ? {
        id: foundExpectedContext.id,
        title: foundExpectedContext.title
      } : null
    })

  } catch (error) {
    console.error('💥 TEST FAILED:', error)
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
})