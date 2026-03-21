/**
 * Integration Tests: API Key RLS Enforcement
 *
 * Tests that API keys properly enforce Row Level Security (RLS) policies
 * instead of bypassing them like service role access would.
 *
 * Critical security test: API keys should NOT have service role privileges.
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, test, expect, beforeAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('API Key RLS Enforcement Tests', () => {
  const harness = new ApiTestHarness()

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 API Key RLS test environment validated')
  })

  describe('Cross-User Access Prevention', () => {
    test('should prevent API key from accessing another user\'s personal context', async () => {
      // Act: Try to access contexts using API key 1
      const response1 = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(response1.status).toBe(200)
      const data1 = await response1.json()

      // Act: Try to access contexts using API key 2 (different user)
      const response2 = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_2!)

      expect(response2.status).toBe(200)
      const data2 = await response2.json()

      // Assert: Each API key should only see their own contexts
      expect(data1.contexts).toBeDefined()
      expect(data2.contexts).toBeDefined()

      // Verify user 1's personal context is not visible to user 2
      const user1PersonalContext = data1.contexts.find((c: any) => c.id.startsWith('personal:'))
      const user2PersonalContext = data2.contexts.find((c: any) => c.id.startsWith('personal:'))

      expect(user1PersonalContext).toBeDefined()
      expect(user2PersonalContext).toBeDefined()
      expect(user1PersonalContext.id).not.toBe(user2PersonalContext.id)
    })

    test('should prevent API key from creating endeavors in another user\'s context', async () => {
      // Arrange: Get user 1's personal context ID
      const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      const contextsData = await contextsResponse.json()
      const user1PersonalContextId = contextsData.contexts.find((c: any) => c.id.startsWith('personal:')).id

      // Act: Try to create endeavor in user 1's context using user 2's API key
      const createRequest = {
        title: 'Unauthorized Access Attempt',
        type: 'mission',
        contextId: user1PersonalContextId
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_2!)

      // Assert: Should be blocked by contract validation (which prevents RLS violations)
      expect(response.status).toBe(400)

      const errorData = await response.json()
      expect(errorData.error).toMatch(/contract violation|personal context id mismatch/i)
    })

    test('should prevent API key from accessing another user\'s endeavors', async () => {
      // Arrange: Create endeavor with user 1's API key
      const createRequest = {
        title: 'User 1 Private Endeavor',
        type: 'mission'
      }

      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(200)
      const createData = await createResponse.json()
      const endeavorId = createData.endeavorId

      // Act: Try to access the endeavor using user 2's API key
      const accessResponse = await harness.makeRequestWithKey(`/api/endeavors/${endeavorId}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_2!)

      // Assert: Should be forbidden or not found due to RLS policy
      expect([403, 404]).toContain(accessResponse.status)
    })
  })

  describe('Logs RLS Enforcement', () => {
    test('should prevent API key from creating logs for inaccessible endeavors', async () => {
      // Arrange: Create endeavor with user 1's API key
      const createEndeavorRequest = {
        title: 'User 1 Endeavor for Log Test',
        type: 'mission'
      }

      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(createEndeavorRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(200)
      const endeavorData = await createResponse.json()
      const endeavorId = endeavorData.endeavorId

      // Act: Try to create log for user 1's endeavor using user 2's API key
      const logRequest = {
        entity_type: 'endeavor',
        entity_id: endeavorId,
        content: 'Unauthorized log entry attempt',
        content_type: 'markdown'
      }

      const response = await harness.makeRequestWithKey('/api/logs', {
        method: 'POST',
        body: JSON.stringify(logRequest)
      }, process.env.TEST_API_KEY_2!)

      // Assert: Should be forbidden due to RLS policy
      expect(response.status).toBe(403)

      const errorData = await response.json()
      expect(errorData.error).toMatch(/access.*denied|permission/i)
    })

    test('should allow API key to create logs for accessible endeavors', async () => {
      // Arrange: Create endeavor with user 1's API key
      const createEndeavorRequest = {
        title: 'User 1 Endeavor for Valid Log Test',
        type: 'mission'
      }

      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(createEndeavorRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(200)
      const endeavorData = await createResponse.json()
      const endeavorId = endeavorData.endeavorId

      // Act: Create log for same user's endeavor using same API key
      const logRequest = {
        entity_type: 'endeavor',
        entity_id: endeavorId,
        content: 'Valid log entry for my own endeavor',
        content_type: 'markdown'
      }

      const response = await harness.makeRequestWithKey('/api/logs', {
        method: 'POST',
        body: JSON.stringify(logRequest)
      }, process.env.TEST_API_KEY_1!)

      // Assert: Should succeed
      expect(response.status).toBe(201)

      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      expect(responseData.log.entity_id).toBe(endeavorId)
    })
  })

  describe('Service Role vs API Key Behavior', () => {
    test('should NOT bypass RLS like service role would', async () => {
      // This test verifies that API keys create user-scoped clients,
      // not service role clients that bypass RLS entirely.

      // Arrange: Get total context count using both API keys
      const response1 = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      const response2 = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_2!)

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      const data1 = await response1.json()
      const data2 = await response2.json()

      // Assert: Each API key should see only user-specific data
      // If API keys had service role access, they would see ALL contexts in the database
      expect(data1.contexts.length).toBeGreaterThan(0)
      expect(data2.contexts.length).toBeGreaterThan(0)

      // Critical assertion: The results should be different (user-scoped, not global)
      const contextIds1 = data1.contexts.map((c: any) => c.id).sort()
      const contextIds2 = data2.contexts.map((c: any) => c.id).sort()

      expect(contextIds1).not.toEqual(contextIds2)

      // Each user should only see their own personal context
      const personalContexts1 = data1.contexts.filter((c: any) => c.id.startsWith('personal:'))
      const personalContexts2 = data2.contexts.filter((c: any) => c.id.startsWith('personal:'))

      expect(personalContexts1).toHaveLength(1)
      expect(personalContexts2).toHaveLength(1)
      expect(personalContexts1[0].id).not.toBe(personalContexts2[0].id)
    })
  })
})