import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('Dashboard Visibility Bug Tests', () => {
  const harness = new ApiTestHarness({ port: 3003 })

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 Dashboard visibility test environment validated')

    // Start the app and wait for it to be ready
    await harness.startApp()
    await harness.waitForReady()
  }, 180000)

  afterAll(async () => {
    await harness.stopApp()
  })

  test('should show created endeavors in dashboard', async () => {
    console.log('🐛 Testing the dashboard visibility bug')

    // Step 1: Create an endeavor via the API
    console.log('📝 Creating endeavor via /api/endeavors/create')
    const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Dashboard Visibility',
        type: 'mission',
        contextId: 'personal'
      })
    }, process.env.TEST_API_KEY_1!)

    if (!createResponse.ok) {
      const errorResult = await createResponse.json()
      console.error('🚨 Endeavor creation failed:', createResponse.status, errorResult)
    }
    expect(createResponse.ok).toBe(true)
    const createResult = await createResponse.json()
    console.log('✅ Created endeavor:', createResult.endeavorId)

    // Step 2: Check dashboard API directly
    console.log('🏠 Checking dashboard API for personal context')
    const dashboardResponse = await harness.makeRequestWithKey('/api/dashboard?contextId=personal', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(dashboardResponse.ok).toBe(true)
    const dashboardData = await dashboardResponse.json()
    console.log('🏠 Dashboard returned nodes:', dashboardData.nodes?.length || 0)

    if (dashboardData.nodes && dashboardData.nodes.length > 0) {
      console.log('🏠 Dashboard nodes:', dashboardData.nodes.map((n: any) => ({ id: n.id, title: n.title, context_id: n.context_id })))
    }

    // Step 3: The bug - endeavor should be visible but might not be
    const createdEndeavor = dashboardData.nodes?.find((node: any) => node.id === createResult.endeavorId)

    if (!createdEndeavor) {
      console.error('🐛 BUG REPRODUCED: Endeavor was created but does not appear in dashboard!')
      console.error('🐛 Created endeavor ID:', createResult.endeavorId)
      console.error('🐛 Dashboard nodes:', dashboardData.nodes?.map((n: any) => n.id) || [])

      // Let's check what's actually in the database
      console.log('🔍 Checking raw database via personal endeavors API...')
      const personalResponse = await harness.makeRequestWithKey('/api/endeavors/personal', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      if (personalResponse.ok) {
        const personalData = await personalResponse.json()
        console.log('🔍 Personal endeavors API returned:', personalData.endeavors?.length || 0)
        console.log('🔍 Personal endeavors:', personalData.endeavors?.map((e: any) => ({
          id: e.id,
          title: e.title,
          node_type: e.node_type,
          context_id: e.context_id
        })) || [])
      }
    }

    // This test will fail if the bug exists
    expect(createdEndeavor).toBeDefined()
    expect(createdEndeavor?.title).toBe('Test Dashboard Visibility')
  }, 30000)

  test('should show endeavors created with different node types', async () => {
    console.log('🐛 Testing different node types visibility')

    const types = ['mission', 'aim', 'initiative', 'task']
    const createdIds: string[] = []

    // Create endeavors of different types
    for (const type of types) {
      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: `Test ${type} visibility`,
          type: type,
          contextId: 'personal'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.ok).toBe(true)
      const result = await createResponse.json()
      createdIds.push(result.endeavorId)
      console.log(`✅ Created ${type}:`, result.endeavorId)
    }

    // Check if all show up in dashboard
    const dashboardResponse = await harness.makeRequestWithKey('/api/dashboard?contextId=personal', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(dashboardResponse.ok).toBe(true)
    const dashboardData = await dashboardResponse.json()
    console.log('🏠 Dashboard total nodes:', dashboardData.nodes?.length || 0)

    // Check each created endeavor appears
    for (let i = 0; i < createdIds.length; i++) {
      const endeavorId = createdIds[i]
      const type = types[i]
      const foundNode = dashboardData.nodes?.find((node: any) => node.id === endeavorId)

      if (!foundNode) {
        console.error(`🐛 BUG: ${type} endeavor ${endeavorId} not visible in dashboard`)
      } else {
        console.log(`✅ ${type} endeavor visible:`, foundNode.title)
      }

      expect(foundNode).toBeDefined()
    }
  }, 30000)
})