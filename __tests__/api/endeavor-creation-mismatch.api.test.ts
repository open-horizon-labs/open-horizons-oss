/**
 * Integration test to reproduce the endeavor creation failure
 * Tests the exact scenario where UI fails to create endeavors
 */

import { ApiTestHarness } from './api-harness'

describe('Endeavor Creation Context Mismatch', () => {
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

  it('should catch context ID mismatch with enhanced validation (not FK violation)', async () => {
    // First get the user's actual contexts
    const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(contextsResponse.status).toBe(200)
    const contextsData = await contextsResponse.json()

    console.log(`📊 User has ${contextsData.contexts?.length || 0} contexts`)
    if (contextsData.contexts) {
      contextsData.contexts.forEach((ctx: any) => {
        console.log(`  - ${ctx.id}: "${ctx.title}" (created by ${ctx.created_by})`)
      })
    }

    // Try to create an endeavor with a non-existent personal context ID
    // This mimics what the UI is doing wrong
    const fakePersonalContextId = 'personal:2cba8911-6bc9-4b33-a2b2-3d8fcfa9bd35'

    const createEndeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test mission',
        type: 'mission',
        parentId: '',
        contextId: fakePersonalContextId  // This should cause the FK violation
      })
    }, process.env.TEST_API_KEY_1!)

    // NEW: This should now fail with a 400 error due to contract validation (not 500 FK violation)
    // This demonstrates that our enhanced validation catches the problem BEFORE hitting the database
    expect(createEndeavorResponse.status).toBe(400)
    const errorResult = await createEndeavorResponse.json()

    expect(errorResult.error).toBeDefined()
    expect(errorResult.error).toContain('Contract violation')
    expect(errorResult.details).toContain('Personal context ID mismatch')
    expect(errorResult.details).toContain('session/authentication bug')

    console.log(`✅ Enhanced validation caught context mismatch at contract layer: ${errorResult.error}`)
    console.log(`📋 Clear error details: ${errorResult.details}`)
    console.log(`📊 This prevents FK violations and provides better debugging information`)
  })

  it('should succeed when using the correct personal context ID', async () => {
    // Get the user's actual personal context
    const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(contextsResponse.status).toBe(200)
    const contextsData = await contextsResponse.json()

    const personalContext = contextsData.contexts?.find((ctx: any) =>
      ctx.id.startsWith('personal:')
    )

    expect(personalContext).toBeDefined()
    console.log(`✅ Found correct personal context: ${personalContext.id}`)

    // Create endeavor with the CORRECT context ID
    const createEndeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test mission with correct context',
        type: 'mission',
        parentId: '',
        contextId: personalContext.id  // Use the actual personal context ID
      })
    }, process.env.TEST_API_KEY_1!)

    expect(createEndeavorResponse.status).toBe(200)
    const createResult = await createEndeavorResponse.json()

    expect(createResult.success).toBe(true)
    expect(createResult.endeavorId).toBeDefined()

    console.log(`✅ Successfully created endeavor with correct context: ${createResult.endeavorId}`)
  })

  it('should succeed when contextId is null (defaults to personal)', async () => {
    // Create endeavor with null contextId (should default to personal)
    const createEndeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test mission with null context',
        type: 'mission',
        parentId: '',
        contextId: null  // Should default to personal context
      })
    }, process.env.TEST_API_KEY_1!)

    expect(createEndeavorResponse.status).toBe(200)
    const createResult = await createEndeavorResponse.json()

    expect(createResult.success).toBe(true)
    expect(createResult.endeavorId).toBeDefined()

    console.log(`✅ Successfully created endeavor with null context: ${createResult.endeavorId}`)
  })
})