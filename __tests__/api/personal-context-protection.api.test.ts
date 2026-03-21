/**
 * Integration test for personal context protection
 * Verifies personal contexts cannot be directly deleted
 */

import { ApiTestHarness } from './api-harness'

describe('Personal Context Protection API', () => {
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

  it('should reject deletion of personal context', async () => {
    // Get the user's contexts - this will now ensure personal context exists
    const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(contextsResponse.status).toBe(200)
    const contextsData = await contextsResponse.json()

    // Find the personal context
    const personalContext = contextsData.contexts?.find((ctx: any) =>
      ctx.id.startsWith('personal:')
    )

    expect(personalContext).toBeDefined()
    console.log(`📋 Found personal context: ${personalContext.id}`)

    // Attempt to delete the personal context directly
    const deleteResponse = await harness.makeRequestWithKey(`/api/contexts/${encodeURIComponent(personalContext.id)}`, {
      method: 'DELETE'
    }, process.env.TEST_API_KEY_1!)

    // The deletion should be rejected (403 forbidden is most appropriate for protected resources)
    console.log(`🔍 Delete response status: ${deleteResponse.status}`)
    expect([403, 400, 404]).toContain(deleteResponse.status)

    if (deleteResponse.status !== 404) {
      const deleteResult = await deleteResponse.json()
      // Should contain some indication that personal contexts can't be deleted
      const errorMessage = deleteResult.error || deleteResult.message || ''
      expect(errorMessage.toLowerCase()).toMatch(/personal|cannot|protected|forbidden/)
    }

    console.log(`✅ Personal context deletion properly rejected with status ${deleteResponse.status}`)

    // Verify the personal context still exists
    const verifyResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(verifyResponse.status).toBe(200)
    const verifyData = await verifyResponse.json()

    const stillExists = verifyData.contexts?.find((ctx: any) => ctx.id === personalContext.id)
    expect(stillExists).toBeDefined()

    console.log(`✅ Personal context still exists after failed deletion: ${stillExists.id}`)
  })

  it('should preserve personal context during DELETE ALL', async () => {
    // Create a regular context that should be deleted
    const createContextResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Deletable Test Context',
        description: 'This context should be deleted during DELETE ALL'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(createContextResponse.status).toBe(201)
    const createResult = await createContextResponse.json()

    // Get contexts before deletion
    const beforeResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(beforeResponse.status).toBe(200)
    const beforeData = await beforeResponse.json()

    const personalContextBefore = beforeData.contexts?.find((ctx: any) => ctx.id.startsWith('personal:'))
    const regularContextBefore = beforeData.contexts?.find((ctx: any) => ctx.id === createResult.contextId)

    expect(personalContextBefore).toBeDefined()
    expect(regularContextBefore).toBeDefined()

    console.log(`📊 Before DELETE ALL: ${beforeData.contexts.length} contexts`)

    // Perform DELETE ALL
    const deleteAllResponse = await harness.makeRequestWithKey('/api/user/delete-all-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmText: 'YES I AM SURE'
      })
    }, process.env.TEST_API_KEY_1!)

    expect([200, 404]).toContain(deleteAllResponse.status)

    if (deleteAllResponse.status === 200) {
      const deleteAllResult = await deleteAllResponse.json()
      expect(deleteAllResult.success).toBe(true)
      expect(deleteAllResult.personalContextId).toBeDefined()
      console.log(`✅ DELETE ALL preserved personal context: ${deleteAllResult.personalContextId}`)
    }

    // Verify contexts after deletion
    const afterResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(afterResponse.status).toBe(200)
    const afterData = await afterResponse.json()

    // Should have exactly 1 context: the personal context
    expect(afterData.contexts).toHaveLength(1)

    const remainingContext = afterData.contexts[0]
    expect(remainingContext.id).toMatch(/^personal:/)
    expect(remainingContext.id).toBe(personalContextBefore.id)

    // The regular context should be gone
    const regularContextAfter = afterData.contexts?.find((ctx: any) => ctx.id === createResult.contextId)
    expect(regularContextAfter).toBeUndefined()

    console.log(`✅ After DELETE ALL: Only personal context remains (${remainingContext.id})`)
  })
})