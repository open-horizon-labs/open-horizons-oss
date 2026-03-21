/**
 * Integration test for user context creation
 * Verifies only real, database-backed contexts exist after user creation
 */

import { ApiTestHarness } from './api-harness'

describe('User Context Creation API', () => {
  const harness = new ApiTestHarness()

  beforeAll(async () => {
    // Start the app and wait for it to be ready
    await harness.startApp()
    await harness.waitForReady()
    await harness.ensureTestUsersExist()
  }, 30000)

  afterAll(async () => {
    await harness.stopApp()
  })

  it('should only show real database-backed contexts after user creation', async () => {
    // Clean slate - delete all existing data for the test user
    const deleteResponse = await harness.makeRequestWithKey('/api/user/delete-all-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmText: 'YES I AM SURE'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(deleteResponse.status).toBe(200)
    const deleteResult = await deleteResponse.json()
    expect(deleteResult.success).toBe(true)

    console.log('✅ Successfully cleaned test user data')

    // After user setup, check what contexts exist
    const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    // After DELETE ALL, user should always have their personal context recreated
    expect(contextsResponse.status).toBe(200)
    const contextsData = await contextsResponse.json()

    console.log(`📊 User has ${contextsData.contexts?.length || 0} contexts after cleanup`)

    // Verify all contexts are real database-backed contexts
    if (contextsData.contexts && contextsData.contexts.length > 0) {
      for (const context of contextsData.contexts) {
        // Each context should have:
        // - A real database ID (not null, not hardcoded like 'personal')
        // - A title from the database
        // - A created_by field
        // - A proper creation timestamp
        expect(context.id).toBeDefined()
        expect(context.id).not.toBe(null)
        expect(context.id).not.toBe('personal')
        expect(context.title).toBeDefined()
        expect(context.created_by).toBeDefined()
        expect(context.created_at).toBeDefined()

        console.log(`✅ Context validated: ${context.id} - "${context.title}" (created by ${context.created_by})`)
      }
    }

    // Filter to only contexts owned by this test user
    const testUserId = deleteResult.personalContextId?.replace('personal:', '') || ''
    const ownedContexts = contextsData.contexts?.filter((ctx: any) =>
      ctx.created_by === testUserId
    ) || []

    console.log(`📊 User owns ${ownedContexts.length} contexts (filtered from ${contextsData.contexts?.length || 0} total)`)

    // User should have exactly one owned context after cleanup: their personal context
    expect(ownedContexts).toHaveLength(1)

    const personalContext = ownedContexts[0]
    expect(personalContext.id).toMatch(/^personal:/)
    expect(personalContext.created_by).toBe(testUserId)

    // The title should not be the old hardcoded "Personal Workspace"
    expect(personalContext.title).not.toBe('Personal Workspace')
    expect(personalContext.title).not.toBe('Personal')

    console.log(`✅ User has personal context: ${personalContext.id} - "${personalContext.title}"`)

    // API and app should use same paths - verify context endpoint consistency
    // The /api/contexts endpoint should return the same structure as what the app expects
    if (contextsData.contexts) {
      expect(Array.isArray(contextsData.contexts)).toBe(true)
      console.log('✅ API returns contexts in expected array format')
    }

    console.log('✅ Only real, database-backed contexts exist after user creation')
  })

  it('should allow creation of new real contexts', async () => {
    // Create a new context to verify the flow works
    const createContextResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Real Context',
        description: 'A real database-backed context for testing'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(createContextResponse.status).toBe(201)
    const createResult = await createContextResponse.json()
    expect(createResult.success).toBe(true)
    expect(createResult.contextId).toBeDefined()

    // Verify the new context appears in the list
    const listContextsResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(listContextsResponse.status).toBe(200)
    const listResult = await listContextsResponse.json()

    const newContext = listResult.contexts?.find((ctx: any) => ctx.id === createResult.contextId)
    expect(newContext).toBeDefined()
    expect(newContext.title).toBe('Test Real Context')
    expect(newContext.id).not.toBe('personal')
    expect(newContext.id).not.toBe(null)

    console.log(`✅ Created and verified real context: ${createResult.contextId}`)
  })
})