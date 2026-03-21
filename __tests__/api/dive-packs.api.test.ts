/**
 * Integration Tests: Dive Packs API
 *
 * Tests the dive-packs API endpoints against the actual database and API routes.
 * Dive Packs are curated grounding context for working sessions.
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, test, expect, beforeAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('Dive Packs API Integration Tests', () => {
  const harness = new ApiTestHarness()

  // Test data holders
  let testEndeavor: { endeavorId: string; title: string }
  let testDivePack: { id: string }

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 Dive Packs API test environment validated')

    // Create a test endeavor to use for dive packs
    const createEndeavorRequest = {
      title: 'Test Endeavor for Dive Packs',
      type: 'initiative'
    }

    const createEndeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify(createEndeavorRequest)
    }, process.env.TEST_API_KEY_1!)

    expect(createEndeavorResponse.status).toBe(200)
    const endeavorData = await createEndeavorResponse.json()
    testEndeavor = { endeavorId: endeavorData.endeavorId, title: createEndeavorRequest.title }
    console.log(`📋 Created test endeavor: ${testEndeavor.endeavorId}`)
  })

  describe('POST /api/dive-packs - Create Dive Pack', () => {
    test('should create a dive pack for an endeavor', async () => {
      // Arrange: Valid dive pack creation request
      const createRequest = {
        primary_endeavor_id: testEndeavor.endeavorId,
        source_snapshot: {
          endeavor_versions: { [testEndeavor.endeavorId]: new Date().toISOString() },
          metis_ids: [],
          guardrail_ids: []
        },
        content: {
          constitutional: {
            mission_context: 'Test mission context for dive pack',
            standing_guardrails: ['Always test first', 'Contract-first development']
          },
          endeavors: [
            { id: testEndeavor.endeavorId, title: testEndeavor.title, type: 'Initiative', role: 'primary' }
          ],
          metis: [],
          guardrails: [],
          tools: [{ name: 'integration-test.sh', description: 'Run integration tests' }],
          notes: 'Test dive pack for API testing'
        },
        rendered_md: `# Dive Context\nGenerated: ${new Date().toISOString()}\n\n## Intent\nTest dive pack for API testing`
      }

      // Act: POST to create dive pack
      const response = await harness.makeRequestWithKey('/api/dive-packs', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_1!)

      // Assert: Response validation
      expect(response.status).toBe(201)

      const responseData = await response.json()

      expect(responseData.id).toBeTruthy()
      expect(responseData.primary_endeavor_id).toBe(testEndeavor.endeavorId)
      expect(responseData.status).toBe('active')
      expect(responseData.created_at).toBeTruthy()

      // Store for later tests
      testDivePack = { id: responseData.id }
      console.log(`📦 Created test dive pack: ${testDivePack.id}`)
    })

    test('should reject dive pack creation without required fields', async () => {
      // Arrange: Request missing required fields
      const invalidRequest = {
        // Missing primary_endeavor_id, source_snapshot, content, rendered_md
      }

      // Act: POST with invalid request
      const response = await harness.makeRequestWithKey('/api/dive-packs', {
        method: 'POST',
        body: JSON.stringify(invalidRequest)
      }, process.env.TEST_API_KEY_1!)

      // Assert: Should fail validation
      expect(response.status).toBe(400)

      const responseData = await response.json()
      expect(responseData.error).toBeTruthy()
    })

    test('should reject dive pack creation for non-existent endeavor', async () => {
      // Arrange: Request with fake endeavor ID
      const invalidRequest = {
        primary_endeavor_id: 'non-existent-endeavor-id',
        source_snapshot: { endeavor_versions: {}, metis_ids: [], guardrail_ids: [] },
        content: { constitutional: { mission_context: '', standing_guardrails: [] } },
        rendered_md: '# Test'
      }

      // Act: POST with non-existent endeavor
      const response = await harness.makeRequestWithKey('/api/dive-packs', {
        method: 'POST',
        body: JSON.stringify(invalidRequest)
      }, process.env.TEST_API_KEY_1!)

      // Assert: Should fail (either 400 or 404)
      expect([400, 404]).toContain(response.status)
    })

    test('should reject unauthorized requests', async () => {
      // Arrange: Valid request but no auth
      const createRequest = {
        primary_endeavor_id: testEndeavor.endeavorId,
        source_snapshot: { endeavor_versions: {}, metis_ids: [], guardrail_ids: [] },
        content: { constitutional: { mission_context: '', standing_guardrails: [] } },
        rendered_md: '# Test'
      }

      // Act: POST without authorization
      const response = await harness.makePublicRequest('/api/dive-packs', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      })

      // Assert: Should be unauthorized
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/dive-packs/:id - Get Dive Pack', () => {
    test('should get a dive pack by ID', async () => {
      // Act: GET the dive pack created earlier
      const response = await harness.makeRequestWithKey(`/api/dive-packs/${testDivePack.id}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      // Assert: Response validation
      expect(response.status).toBe(200)

      const responseData = await response.json()

      expect(responseData.id).toBe(testDivePack.id)
      expect(responseData.primary_endeavor_id).toBe(testEndeavor.endeavorId)
      expect(responseData.status).toBe('active')
      expect(responseData.source_snapshot).toBeTruthy()
      expect(responseData.content).toBeTruthy()
      expect(responseData.rendered_md).toBeTruthy()
      expect(responseData.created_at).toBeTruthy()
      expect(responseData.created_by).toBeTruthy()
    })

    test('should return 404 for non-existent dive pack', async () => {
      // Act: GET non-existent pack
      const response = await harness.makeRequestWithKey('/api/dive-packs/00000000-0000-0000-0000-000000000000', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      // Assert: Should be not found
      expect(response.status).toBe(404)
    })

    test('should reject unauthorized requests', async () => {
      // Act: GET without authorization
      const response = await harness.makePublicRequest(`/api/dive-packs/${testDivePack.id}`, {
        method: 'GET'
      })

      // Assert: Should be unauthorized
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/endeavors/:id/dive-packs - List Dive Packs', () => {
    test('should list dive packs for an endeavor', async () => {
      // Act: GET dive packs for the test endeavor
      const response = await harness.makeRequestWithKey(`/api/endeavors/${testEndeavor.endeavorId}/dive-packs`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      // Assert: Response validation
      expect(response.status).toBe(200)

      const responseData = await response.json()

      expect(responseData.dive_packs).toBeDefined()
      expect(Array.isArray(responseData.dive_packs)).toBe(true)
      expect(responseData.dive_packs.length).toBeGreaterThanOrEqual(1)

      // Find our test pack in the list
      const ourPack = responseData.dive_packs.find((p: any) => p.id === testDivePack.id)
      expect(ourPack).toBeTruthy()
      expect(ourPack.status).toBe('active')
    })

    test('should filter by status', async () => {
      // Act: GET only active packs
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${testEndeavor.endeavorId}/dive-packs?status=active`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      // Assert: Response validation
      expect(response.status).toBe(200)

      const responseData = await response.json()

      expect(responseData.dive_packs).toBeDefined()
      // All returned packs should be active
      for (const pack of responseData.dive_packs) {
        expect(pack.status).toBe('active')
      }
    })

    test('should return empty array for endeavor with no dive packs', async () => {
      // Create a new endeavor with no dive packs
      const createEndeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'Endeavor Without Dive Packs', type: 'task' })
      }, process.env.TEST_API_KEY_1!)

      const newEndeavor = await createEndeavorResponse.json()

      // Act: GET dive packs for endeavor with none
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${newEndeavor.endeavorId}/dive-packs`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      // Assert: Should return empty array, not error
      expect(response.status).toBe(200)

      const responseData = await response.json()
      expect(responseData.dive_packs).toEqual([])
    })
  })

  describe('PATCH /api/dive-packs/:id - Archive/Unarchive Dive Pack', () => {
    test('should archive a dive pack', async () => {
      // Act: PATCH to archive
      const response = await harness.makeRequestWithKey(`/api/dive-packs/${testDivePack.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' })
      }, process.env.TEST_API_KEY_1!)

      // Assert: Response validation
      expect(response.status).toBe(200)

      const responseData = await response.json()
      expect(responseData.id).toBe(testDivePack.id)
      expect(responseData.status).toBe('archived')
    })

    test('should unarchive a dive pack', async () => {
      // Act: PATCH to unarchive
      const response = await harness.makeRequestWithKey(`/api/dive-packs/${testDivePack.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' })
      }, process.env.TEST_API_KEY_1!)

      // Assert: Response validation
      expect(response.status).toBe(200)

      const responseData = await response.json()
      expect(responseData.id).toBe(testDivePack.id)
      expect(responseData.status).toBe('active')
    })

    test('should reject invalid status', async () => {
      // Act: PATCH with invalid status
      const response = await harness.makeRequestWithKey(`/api/dive-packs/${testDivePack.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'invalid-status' })
      }, process.env.TEST_API_KEY_1!)

      // Assert: Should fail validation
      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/endeavors/:id/dive-context - Get Dive Context', () => {
    test('should get dive context for an endeavor', async () => {
      // Act: GET dive context
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${testEndeavor.endeavorId}/dive-context`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      // Assert: Response validation
      expect(response.status).toBe(200)

      const responseData = await response.json()

      // Verify structure matches design
      expect(responseData.endeavor).toBeDefined()
      expect(responseData.endeavor.id).toBe(testEndeavor.endeavorId)
      expect(responseData.endeavor.title).toBe(testEndeavor.title)

      expect(responseData.ancestors).toBeDefined()
      expect(Array.isArray(responseData.ancestors)).toBe(true)

      expect(responseData.children).toBeDefined()
      expect(Array.isArray(responseData.children)).toBe(true)

      expect(responseData.siblings).toBeDefined()
      expect(Array.isArray(responseData.siblings)).toBe(true)

      expect(responseData.metis).toBeDefined()
      expect(Array.isArray(responseData.metis)).toBe(true)

      expect(responseData.guardrails).toBeDefined()
      expect(Array.isArray(responseData.guardrails)).toBe(true)

      expect(responseData.recent_logs).toBeDefined()
      expect(Array.isArray(responseData.recent_logs)).toBe(true)
    })

    test('should return 404 for non-existent endeavor', async () => {
      // Act: GET dive context for non-existent endeavor
      const response = await harness.makeRequestWithKey(
        '/api/endeavors/non-existent-id/dive-context',
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      // Assert: Should be not found
      expect(response.status).toBe(404)
    })

    test('should reject unauthorized requests', async () => {
      // Act: GET without authorization
      const response = await harness.makePublicRequest(
        `/api/endeavors/${testEndeavor.endeavorId}/dive-context`,
        { method: 'GET' }
      )

      // Assert: Should be unauthorized
      expect(response.status).toBe(401)
    })
  })

  describe('DELETE /api/dive-packs/:id - Delete Dive Pack', () => {
    test('should delete a dive pack', async () => {
      // First create a pack to delete
      const createRequest = {
        primary_endeavor_id: testEndeavor.endeavorId,
        source_snapshot: { endeavor_versions: {}, metis_ids: [], guardrail_ids: [] },
        content: {
          constitutional: { mission_context: 'To be deleted', standing_guardrails: [] },
          endeavors: [],
          metis: [],
          guardrails: [],
          tools: [],
          notes: 'Temporary pack for deletion test'
        },
        rendered_md: '# Temporary'
      }

      const createResponse = await harness.makeRequestWithKey('/api/dive-packs', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(201)
      const packToDelete = await createResponse.json()

      // Act: DELETE the pack
      const deleteResponse = await harness.makeRequestWithKey(`/api/dive-packs/${packToDelete.id}`, {
        method: 'DELETE'
      }, process.env.TEST_API_KEY_1!)

      // Assert: Should succeed
      expect(deleteResponse.status).toBe(200)

      // Verify it's gone
      const getResponse = await harness.makeRequestWithKey(`/api/dive-packs/${packToDelete.id}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(getResponse.status).toBe(404)
    })

    test('should not allow deleting another user\'s dive pack', async () => {
      // Create a pack with user 1
      const createRequest = {
        primary_endeavor_id: testEndeavor.endeavorId,
        source_snapshot: { endeavor_versions: {}, metis_ids: [], guardrail_ids: [] },
        content: {
          constitutional: { mission_context: 'User 1 pack', standing_guardrails: [] },
          endeavors: [],
          metis: [],
          guardrails: [],
          tools: [],
          notes: 'Pack owned by user 1'
        },
        rendered_md: '# User 1 Pack'
      }

      const createResponse = await harness.makeRequestWithKey('/api/dive-packs', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(201)
      const user1Pack = await createResponse.json()

      // Act: Try to delete with user 2's key
      const deleteResponse = await harness.makeRequestWithKey(`/api/dive-packs/${user1Pack.id}`, {
        method: 'DELETE'
      }, process.env.TEST_API_KEY_2!)

      // Assert: Should be forbidden (403) or not found (404 due to RLS)
      expect([403, 404]).toContain(deleteResponse.status)
    })
  })
})
