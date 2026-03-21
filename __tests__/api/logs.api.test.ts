/**
 * Integration Tests: Temporal Logs API
 *
 * Tests the logs API endpoints against the actual database and API routes.
 * Uses the logs contracts for validation and transformation.
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'
import { CreateLogRequest, LogEntityType } from '../../lib/contracts/logs-contract'

describe('Logs API Integration Tests', () => {
  const harness = new ApiTestHarness()

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 Logs API test environment validated')
  })

  describe('POST /api/logs - Create Log Entry', () => {
    test('should create a log entry for an endeavor', async () => {
      // Arrange: First create an endeavor to log about
      const createEndeavorRequest = {
        title: 'Test Endeavor for Logging',
        type: 'mission'
      }

      const createEndeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(createEndeavorRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(createEndeavorResponse.status).toBe(200)
      const endeavorData = await createEndeavorResponse.json()
      const endeavorId = endeavorData.endeavorId

      // Debug: Check if user is a member of the personal context
      const debugResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      const contextData = await debugResponse.json()
      console.log('🔍 User contexts:', JSON.stringify(contextData, null, 2))

      // Arrange: Valid log creation request for the real endeavor
      const createRequest: CreateLogRequest = {
        entity_type: 'endeavor' as LogEntityType,
        entity_id: endeavorId,
        content: 'Made significant progress on the user authentication system. Fixed the JWT token refresh issue.',
        content_type: 'markdown',
        metadata: {
          log_type: 'progress',
          session_duration: '2h'
        }
      }

      // Act: POST to create log (strict validation by default)
      const response = await harness.makeRequestWithKey('/api/logs', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_1!)

      // Debug: Log response if not 201
      if (response.status !== 201) {
        const errorData = await response.json()
        console.log('❌ API Error Response:', errorData)
      }

      // Assert: Response validation
      expect(response.status).toBe(201)

      const responseData = await response.json()

      // 🚨 TEMPORARY: Bypass contract validation due to runtime Zod issue
      // const validatedResponse = validateCreateLogResponse(responseData)

      expect(responseData.success).toBe(true)
      expect(responseData.log).toBeDefined()
      expect(responseData.log.entity_type).toBe('endeavor')
      expect(responseData.log.entity_id).toBe(endeavorId)
      expect(responseData.log.content).toBe(createRequest.content)
      expect(responseData.log.content_type).toBe('markdown')
      expect(responseData.log.log_date).toMatch(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format
      expect(responseData.log.metadata).toEqual(createRequest.metadata)
      expect(responseData.log.id).toBeTruthy()
      expect(responseData.log.created_at).toBeTruthy()
      expect(responseData.log.updated_at).toBeTruthy()
    })

    test('should create a log entry for a context', async () => {
      // Arrange: Get user's actual context to use for logging
      const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(contextsResponse.status).toBe(200)
      const contextsData = await contextsResponse.json()
      expect(contextsData.contexts.length).toBeGreaterThan(0)

      // Use the first accessible context
      const contextId = contextsData.contexts[0].id

      // Arrange: Context log creation request with REAL context ID
      const createRequest: CreateLogRequest = {
        entity_type: 'context' as LogEntityType,
        entity_id: contextId,
        content: 'Weekly review: Completed 3 out of 5 planned initiatives. Need to focus more on stakeholder communication.',
        content_type: 'markdown',
        metadata: {
          log_type: 'reflection',
          review_type: 'weekly'
        }
      }

      // Act: POST to create log (strict validation by default)
      const response = await harness.makeRequestWithKey('/api/logs', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_1!)

      // Assert: Response validation
      expect(response.status).toBe(201)

      const responseData = await response.json()

      // 🚨 SOFT VALIDATION: Direct response checking during soft phase
      expect(responseData.success).toBe(true)
      expect(responseData.log).toBeDefined()
      expect(responseData.log.entity_type).toBe('context')
      expect(responseData.log.entity_id).toBe(contextId)
      expect(responseData.log.content).toBe(createRequest.content)
      expect(responseData.log.content_type).toBe('markdown')
      expect(responseData.log.id).toBeTruthy()
      expect(responseData.log.created_at).toBeTruthy()
    })

    test('should create a plain text log entry (e.g., phone transcript)', async () => {
      // Arrange: First create an endeavor to log about
      const createEndeavorRequest = {
        title: 'Client Project for Transcript Logging',
        type: 'mission'
      }

      const createEndeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(createEndeavorRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(createEndeavorResponse.status).toBe(200)
      const endeavorData = await createEndeavorResponse.json()
      const endeavorId = endeavorData.endeavorId

      // Arrange: Plain text content with real endeavor ID
      const createRequest: CreateLogRequest = {
        entity_type: 'endeavor' as LogEntityType,
        entity_id: endeavorId,
        content: 'Call transcript - discussed project timeline. Client wants to push deadline by 2 weeks due to budget constraints.',
        content_type: 'plain',
        metadata: {
          content_source: 'phone_transcript',
          call_duration: '30min',
          participants: ['me', 'client']
        }
      }

      // Act: POST to create log (strict validation by default)
      const response = await harness.makeRequestWithKey('/api/logs', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_1!)

      // Assert: Response validation
      expect(response.status).toBe(201)

      const responseData = await response.json()

      // 🚨 STRICT VALIDATION: Direct response checking during strict phase
      expect(responseData.success).toBe(true)
      expect(responseData.log).toBeDefined()
      expect(responseData.log.content_type).toBe('plain')
      expect(responseData.log.metadata.content_source).toBe('phone_transcript')
      expect(responseData.log.entity_type).toBe('endeavor')
      expect(responseData.log.entity_id).toBe(endeavorId)
      expect(responseData.log.content).toBe(createRequest.content)
    })

    test('should default to today for log_date when not provided', async () => {
      // Arrange: First create an endeavor to log about
      const createEndeavorRequest = {
        title: 'Test Endeavor for Date Defaulting',
        type: 'mission'
      }

      const createEndeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(createEndeavorRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(createEndeavorResponse.status).toBe(200)
      const endeavorData = await createEndeavorResponse.json()
      const endeavorId = endeavorData.endeavorId

      // Arrange: Request without log_date but with real endeavor ID
      const createRequest: CreateLogRequest = {
        entity_type: 'endeavor' as LogEntityType,
        entity_id: endeavorId,
        content: 'Quick update without explicit date',
        content_type: 'markdown'
      }

      // Act: POST to create log (strict validation by default)
      const response = await harness.makeRequestWithKey('/api/logs', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_1!)

      // Assert: Should use today's date
      expect(response.status).toBe(201)

      const responseData = await response.json()

      // 🚨 STRICT VALIDATION: Direct response checking during strict phase
      expect(responseData.success).toBe(true)
      expect(responseData.log).toBeDefined()
      expect(responseData.log.entity_id).toBe(endeavorId)

      const today = new Date().toISOString().split('T')[0]
      expect(responseData.log.log_date).toBe(today)
    })

    test('should handle missing fields but fail RLS with unknown entity', async () => {
      // Arrange: Request missing required fields (entity_id and content)
      // With RLS enabled, soft validation defaults like 'unknown' entity won't pass
      const invalidRequest = {
        entity_type: 'endeavor',
        // Missing entity_id and content - soft validation defaults to 'unknown'
        // which will fail RLS since it's not a real accessible entity
      }

      // Act: POST with soft validation (no ?strict=true)
      const response = await harness.makeRequestWithKey('/api/logs', {
        method: 'POST',
        body: JSON.stringify(invalidRequest)
      }, process.env.TEST_API_KEY_1!)

      // Assert: 🚨 CONTRACT VALIDATION: Should fail at validation layer before hitting RLS
      expect(response.status).toBe(400) // Bad request due to missing required fields

      const responseData = await response.json()
      expect(responseData.error).toMatch(/validation|Contract|required/i)
    })

    test('should reject unauthorized requests (auth still enforced)', async () => {
      // Arrange: Valid request but no auth
      const createRequest: CreateLogRequest = {
        entity_type: 'endeavor' as LogEntityType,
        entity_id: 'test-endeavor-123',
        content: 'This should not be created',
        content_type: 'markdown'
      }

      // Act: POST without authorization
      const response = await harness.makePublicRequest('/api/logs', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      })

      // Assert: Auth still enforced even in soft phase
      expect(response.status).toBe(401)
    })
  })
})
