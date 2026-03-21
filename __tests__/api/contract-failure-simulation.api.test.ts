/**
 * Contract Failure Simulation Tests
 *
 * This test validates that the API ACTUALLY FAILS when contracts are violated.
 * These are the tests that prove the contract layer prevents schema drift.
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('Contract Failure Simulation Tests', () => {
  const harness = new ApiTestHarness({ port: 3003 })

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 Contract failure simulation environment ready')
    await harness.startApp()
    await harness.waitForReady()
  }, 180000)

  afterAll(async () => {
    await harness.stopApp()
  }, 30000)

  describe('API Fails on Contract Violations', () => {
    it('should return 400 when request violates contract - missing title', async () => {
      const invalidRequest = {
        // title missing - contract violation
        type: 'mission'
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(invalidRequest)
      }, process.env.TEST_API_KEY_1!)

      // API should fail with 400
      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.error).toContain('Contract violation')
      expect(result.details).toBeDefined()
      expect(result.issues).toBeDefined()
      expect(result.issues[0].field).toBe('title')
    })

    it('should return 400 when request violates contract - invalid type', async () => {
      const invalidRequest = {
        title: 'Test',
        type: 'invalid_type' // Invalid type - contract violation
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(invalidRequest)
      }, process.env.TEST_API_KEY_1!)

      // API should fail with 400
      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.error).toContain('Contract violation')
      expect(result.issues[0].field).toBe('type')
    })

    it('should return 400 when request violates contract - title too long', async () => {
      const invalidRequest = {
        title: 'x'.repeat(300), // Too long - contract violation
        type: 'mission'
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(invalidRequest)
      }, process.env.TEST_API_KEY_1!)

      // API should fail with 400
      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.error).toContain('Contract violation')
      expect(result.issues[0].message).toContain('too long')
    })

    it('should return 400 when request violates contract - wrong field types', async () => {
      const invalidRequest = {
        title: 'Test',
        type: 'mission',
        contextId: 123 // Should be string, not number - contract violation
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(invalidRequest)
      }, process.env.TEST_API_KEY_1!)

      // API should fail with 400
      expect(response.status).toBe(400)

      const result = await response.json()
      expect(result.error).toContain('Contract violation')
    })
  })

  describe('Contract Success Stories', () => {
    it('should succeed when request perfectly matches contract', async () => {
      const validRequest = {
        title: 'Perfect Contract Match',
        type: 'mission',
        contextId: null, // Explicitly null is valid
        parentId: null   // Explicitly null is valid
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(validRequest)
      }, process.env.TEST_API_KEY_1!)

      // API should succeed with exactly the contract response format
      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(typeof result.endeavorId).toBe('string')
      expect(result.endeavorId.length).toBeGreaterThan(0)
      expect(result.endeavorId).toContain('mission:')
    })

    it('should succeed with minimal valid request', async () => {
      const minimalRequest = {
        title: 'Minimal',
        type: 'task'
        // contextId and parentId omitted - should be fine per contract
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(minimalRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.endeavorId).toContain('task:')
    })
  })

  describe('Real-World Contract Drift Prevention', () => {
    it('prevents the exact issue we had: API returns capitalized, UI expects lowercase compatibility', async () => {
      // Create an endeavor
      const request = {
        title: 'Case Sensitivity Test',
        type: 'aim'
      }

      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(request)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(200)

      // Get dashboard - this is where the schema drift used to occur
      const dashboardResponse = await harness.makeRequestWithKey('/api/dashboard', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(dashboardResponse.status).toBe(200)
      const dashboardData = await dashboardResponse.json()

      const createdNode = dashboardData.nodes.find((n: any) =>
        n.title === 'Case Sensitivity Test'
      )

      // The contract ensures UI gets exactly what it expects
      expect(createdNode).toBeDefined()
      expect(createdNode.node_type).toBe('Aim') // Capitalized (what API returns)
      expect(createdNode.node_type.toLowerCase()).toBe('aim') // UI can safely lowercase it

      // All required UI fields present due to contract enforcement
      expect(typeof createdNode.id).toBe('string')
      expect(typeof createdNode.title).toBe('string')
      expect(createdNode.hasOwnProperty('parent_id')).toBe(true) // Can be null - use current field name
      expect(typeof createdNode.created_at).toBe('string') // Use current field name
      expect(createdNode.hasOwnProperty('archived_at')).toBe(true) // Can be null - use current field name
      expect(typeof createdNode.metadata).toBe('object')
    })
  })
})