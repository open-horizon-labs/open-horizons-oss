import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('API Key Authentication Context', () => {
  const harness = new ApiTestHarness({ port: 3003 })

  beforeAll(async () => {
    validateEnvironment()

    console.log('🔧 Auth context test environment validated')

    // Start the app and wait for it to be ready
    await harness.startApp()
    await harness.waitForReady()
  }, 180000)

  afterAll(async () => {
    await harness.stopApp()
  }, 30000)

  it('should properly set auth.uid() for API key authentication', async () => {
    // Create a simple API endpoint that returns auth.uid()
    // We'll test this by trying to create a context directly which requires auth.uid() = created_by

    const contextData = {
      title: 'Auth Test Context',
      description: 'Testing if auth.uid() works with API keys'
    }

    const response = await harness.makeRequestWithKey('/api/contexts', {
      method: 'POST',
      body: JSON.stringify(contextData)
    }, process.env.TEST_API_KEY_1!)

    if (response.status !== 201) {
      const errorResult = await response.json()
      console.log('❌ Context creation failed:', response.status, errorResult)
    }

    expect(response.status).toBe(201)

    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.contextId).toBeDefined()

    console.log(`✅ Context created successfully: ${result.contextId}`)
  })

  it('should allow user to access their own created context', async () => {
    // First create a context
    const contextData = {
      title: 'Access Test Context',
      description: 'Testing context access with API keys'
    }

    const createResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'POST',
      body: JSON.stringify(contextData)
    }, process.env.TEST_API_KEY_1!)

    expect(createResponse.status).toBe(201)
    const createResult = await createResponse.json()

    // Then try to list contexts to see if the created context appears
    const listResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(listResponse.status).toBe(200)
    const listResult = await listResponse.json()

    const createdContext = listResult.contexts.find((ctx: any) => ctx.id === createResult.contextId)
    expect(createdContext).toBeDefined()
    expect(createdContext.title).toBe('Access Test Context')

    console.log(`✅ Context accessible in listing: ${createdContext.id}`)
  })

  it('should allow creation of personal contexts', async () => {
    // Test creating a personal context explicitly
    const personalContextData = {
      title: 'Personal Workspace',
      description: 'Your personal endeavors and private work'
    }

    const response = await harness.makeRequestWithKey('/api/contexts', {
      method: 'POST',
      body: JSON.stringify(personalContextData)
    }, process.env.TEST_API_KEY_2!)

    if (response.status !== 201) {
      const errorResult = await response.json()
      console.log('❌ Personal context creation failed:', response.status, errorResult)
    }

    expect(response.status).toBe(201)

    const result = await response.json()
    expect(result.success).toBe(true)
    expect(result.contextId).toBeDefined()

    console.log(`✅ Personal context created successfully: ${result.contextId}`)
  })
})