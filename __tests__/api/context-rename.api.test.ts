/**
 * Integration test for context rename functionality
 * Tests both regular and personal context renaming
 */

import { ApiTestHarness } from './api-harness'

describe('Context Rename API', () => {
  const harness = new ApiTestHarness()
  let originalPersonalContextTitle: string | null = null
  let personalContextId: string | null = null

  beforeAll(async () => {
    // Start the app and wait for it to be ready
    await harness.startApp()
    await harness.waitForReady()
    await harness.ensureTestUsersExist()
  }, 30000)

  afterAll(async () => {
    // CLEANUP: Restore personal context to original title to avoid polluting other tests
    if (personalContextId && originalPersonalContextTitle) {
      try {
        await harness.makeRequestWithKey(`/api/contexts/${encodeURIComponent(personalContextId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: originalPersonalContextTitle,
            description: 'Personal context for individual endeavors'
          })
        }, process.env.TEST_API_KEY_1!)
        console.log(`🧹 Restored personal context title to: "${originalPersonalContextTitle}"`)
      } catch (e) {
        console.warn('⚠️ Failed to restore personal context title:', e)
      }
    }
    await harness.stopApp()
  }, 30000)

  it('should rename a regular context', async () => {
    // First create a context to rename
    const createResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Original Context Title',
        description: 'Original context description'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(createResponse.status).toBe(201)
    const createResult = await createResponse.json()
    const contextId = createResult.contextId

    console.log(`✅ Created context for rename test: ${contextId}`)

    // Now rename the context
    const renameResponse = await harness.makeRequestWithKey(`/api/contexts/${encodeURIComponent(contextId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Context Title',
        description: 'Updated context description'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(renameResponse.status).toBe(200)
    const renameResult = await renameResponse.json()
    expect(renameResult.success).toBe(true)

    console.log(`✅ Successfully renamed context: ${contextId}`)

    // Verify the context was actually renamed by fetching all contexts
    const listResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(listResponse.status).toBe(200)
    const listResult = await listResponse.json()

    const updatedContext = listResult.contexts?.find((ctx: any) => ctx.id === contextId)
    expect(updatedContext).toBeDefined()
    expect(updatedContext.title).toBe('New Context Title')

    console.log(`✅ Verified context rename: "${updatedContext.title}"`)
  })

  it('should rename personal context', async () => {
    // Get the user's personal context
    const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(contextsResponse.status).toBe(200)
    const contextsData = await contextsResponse.json()

    const personalContext = contextsData.contexts?.find((ctx: any) =>
      ctx.id.startsWith('personal:')
    )

    expect(personalContext).toBeDefined()

    // CLEANUP PREP: Store original values for afterAll restoration
    personalContextId = personalContext.id
    originalPersonalContextTitle = personalContext.title

    console.log(`📋 Found personal context: ${personalContext.id} - "${personalContext.title}"`)

    // Rename the personal context
    const renameResponse = await harness.makeRequestWithKey(`/api/contexts/${encodeURIComponent(personalContext.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'My Personal Workspace',
        description: 'My personal context for individual work'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(renameResponse.status).toBe(200)
    const renameResult = await renameResponse.json()
    expect(renameResult.success).toBe(true)

    console.log(`✅ Successfully renamed personal context`)

    // Verify the personal context was renamed
    const verifyResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(verifyResponse.status).toBe(200)
    const verifyData = await verifyResponse.json()

    const updatedPersonalContext = verifyData.contexts?.find((ctx: any) => ctx.id === personalContext.id)
    expect(updatedPersonalContext).toBeDefined()
    expect(updatedPersonalContext.title).toBe('My Personal Workspace')

    console.log(`✅ Verified personal context rename: "${updatedPersonalContext.title}"`)
  })

  it('should reject rename with invalid data', async () => {
    // Get the user's personal context for testing
    const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    const contextsData = await contextsResponse.json()
    const personalContext = contextsData.contexts?.find((ctx: any) => ctx.id.startsWith('personal:'))

    // Try to rename with empty title (should fail validation)
    const renameResponse = await harness.makeRequestWithKey(`/api/contexts/${encodeURIComponent(personalContext.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '',  // Invalid: empty title
        description: 'Valid description'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(renameResponse.status).toBe(400)
    const errorResult = await renameResponse.json()

    expect(errorResult.error).toContain('Contract violation')
    expect(errorResult.issues).toBeDefined()
    expect(Array.isArray(errorResult.issues)).toBe(true)

    const titleIssue = errorResult.issues?.find((issue: any) => issue.field === 'title')
    expect(titleIssue).toBeDefined()
    expect(titleIssue.message).toContain('required')

    console.log(`✅ Contract validation caught empty title: ${errorResult.issues[0].message}`)
  })

  it('should reject rename of non-existent context', async () => {
    const fakeContextId = 'context:fake:nonexistent'

    const renameResponse = await harness.makeRequestWithKey(`/api/contexts/${encodeURIComponent(fakeContextId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Should Not Work',
        description: 'This should fail'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(renameResponse.status).toBe(404)
    const errorResult = await renameResponse.json()

    expect(errorResult.error).toContain('not found')

    console.log(`✅ Non-existent context rename properly rejected: ${errorResult.error}`)
  })

  it('should reject rename of another user\'s context', async () => {
    // User 1 creates a context
    const createResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'User 1 Context',
        description: 'Private to user 1'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(createResponse.status).toBe(201)
    const createResult = await createResponse.json()
    const contextId = createResult.contextId

    // User 2 tries to rename User 1's context (should fail)
    const renameResponse = await harness.makeRequestWithKey(`/api/contexts/${encodeURIComponent(contextId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Hacked Title',
        description: 'This should not work'
      })
    }, process.env.TEST_API_KEY_2!)

    expect(renameResponse.status).toBe(404) // Should not find context due to RLS
    const errorResult = await renameResponse.json()

    expect(errorResult.error).toContain('not found')

    console.log(`✅ Cross-user context access properly blocked: ${errorResult.error}`)
  })
})