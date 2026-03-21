/**
 * Enhanced Contract Validation Tests
 * Tests that contract validation catches context ID mismatches and FK violations
 */

import { ApiTestHarness } from './api-harness'

describe('Enhanced Contract Validation', () => {
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

  it('should catch personal context ID mismatch at contract validation layer', async () => {
    // Try to create an endeavor with wrong user ID in personal context
    const wrongPersonalContextId = 'personal:wrong-user-id-12345'

    const response = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test with wrong personal context',
        type: 'mission',
        parentId: '',
        contextId: wrongPersonalContextId
      })
    }, process.env.TEST_API_KEY_1!)

    // Should fail with contract violation (400) not FK violation (500)
    expect(response.status).toBe(400)
    const errorResult = await response.json()

    expect(errorResult.error).toContain('Contract violation')
    expect(errorResult.details).toContain('Personal context ID mismatch')
    expect(errorResult.details).toContain('session/authentication bug')

    console.log(`✅ Contract validation caught personal context mismatch: ${errorResult.details}`)
  })

  it('should catch non-existent context at validation layer', async () => {
    // Try to create an endeavor with a context that doesn't exist
    const nonExistentContextId = 'context:fake:123456789'

    const response = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test with non-existent context',
        type: 'mission',
        parentId: '',
        contextId: nonExistentContextId
      })
    }, process.env.TEST_API_KEY_1!)

    // Should fail with context validation error (400) not FK violation (500)
    expect(response.status).toBe(400)
    const errorResult = await response.json()

    expect(errorResult.error).toContain('Context validation failed')
    expect(errorResult.details).toContain('does not exist')

    console.log(`✅ Contract validation caught non-existent context: ${errorResult.details}`)
  })

  it('should succeed with null context (resolves to personal)', async () => {
    const response = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test with null context',
        type: 'mission',
        parentId: '',
        contextId: null
      })
    }, process.env.TEST_API_KEY_1!)

    expect(response.status).toBe(200)
    const result = await response.json()

    expect(result.success).toBe(true)
    expect(result.endeavorId).toBeDefined()

    console.log(`✅ Null context resolved successfully: ${result.endeavorId}`)
  })

  it('should succeed with valid personal context ID', async () => {
    // First get the user's actual personal context
    const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(contextsResponse.status).toBe(200)
    const contextsData = await contextsResponse.json()

    const personalContext = contextsData.contexts?.find((ctx: any) =>
      ctx.id.startsWith('personal:')
    )
    expect(personalContext).toBeDefined()

    // Create endeavor with correct personal context ID
    const response = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test with valid personal context',
        type: 'mission',
        parentId: '',
        contextId: personalContext.id
      })
    }, process.env.TEST_API_KEY_1!)

    expect(response.status).toBe(200)
    const result = await response.json()

    expect(result.success).toBe(true)
    expect(result.endeavorId).toBeDefined()

    console.log(`✅ Valid personal context succeeded: ${result.endeavorId}`)
  })

  it('should provide clear error messages for contract violations', async () => {
    // Test with malformed request
    const response = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing required fields
        title: '',  // Empty title should fail
        // type is missing
      })
    }, process.env.TEST_API_KEY_1!)

    expect(response.status).toBe(400)
    const errorResult = await response.json()

    expect(errorResult.error).toContain('Contract violation')
    expect(errorResult.issues).toBeDefined()
    expect(Array.isArray(errorResult.issues)).toBe(true)

    // Should have specific field-level errors
    const titleIssue = errorResult.issues?.find((issue: any) => issue.field === 'title')
    const typeIssue = errorResult.issues?.find((issue: any) => issue.field === 'type')

    expect(titleIssue).toBeDefined()
    expect(typeIssue).toBeDefined()

    console.log(`✅ Contract provided detailed validation errors:`, errorResult.issues)
  })
})