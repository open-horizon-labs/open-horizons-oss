/**
 * Integration Tests: Reflect Mode API
 *
 * Tests the reflect API endpoints for candidate extraction, review, and promotion.
 * Following test-first development - these tests are written before implementation.
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, test, expect, beforeAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'
import {
  ITEM_THRESHOLD,
  DAY_THRESHOLD,
} from '../../lib/contracts/reflect-contract'

describe('Reflect API Integration Tests', () => {
  const harness = new ApiTestHarness()
  let testEndeavorId: string
  let testContextId: string

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 Reflect API test environment validated')

    // Create a test endeavor to use across tests
    const createEndeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Endeavor for Reflect',
        type: 'mission'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(createEndeavorResponse.status).toBe(200)
    const endeavorData = await createEndeavorResponse.json()
    testEndeavorId = endeavorData.endeavorId
    testContextId = endeavorData.contextId || 'personal'

    console.log(`📋 Created test endeavor: ${testEndeavorId}`)
  })

  describe('GET /api/reflect/status/[endeavorId] - Review Status', () => {
    test('should return review status for endeavor with no candidates', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/reflect/status/${testEndeavorId}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.endeavor_id).toBe(testEndeavorId)
      expect(data.pending_candidates).toBe(0)
      expect(data.should_trigger).toBe(false)
      expect(data.trigger_reason).toBe('none')
    })

    test('should trigger when item threshold met', async () => {
      // Create candidates to hit threshold
      for (let i = 0; i < ITEM_THRESHOLD; i++) {
        await harness.makeRequestWithKey('/api/candidates', {
          method: 'POST',
          body: JSON.stringify({
            type: 'metis',
            endeavor_id: testEndeavorId,
            content: `Test candidate ${i + 1} for threshold testing`
          })
        }, process.env.TEST_API_KEY_1!)
      }

      const response = await harness.makeRequestWithKey(
        `/api/reflect/status/${testEndeavorId}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.pending_candidates).toBeGreaterThanOrEqual(ITEM_THRESHOLD)
      expect(data.should_trigger).toBe(true)
      expect(data.trigger_reason).toBe('item_threshold')
    })
  })

  describe('GET /api/reflect/knowledge/[endeavorId] - Active Knowledge', () => {
    test('should return empty metis and guardrails for new endeavor', async () => {
      // Create a fresh endeavor for this test
      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Fresh Endeavor for Knowledge Test',
          type: 'aim'
        })
      }, process.env.TEST_API_KEY_1!)

      const { endeavorId } = await createResponse.json()

      const response = await harness.makeRequestWithKey(
        `/api/reflect/knowledge/${endeavorId}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.endeavor_id).toBe(endeavorId)
      expect(data.metis).toEqual([])
      expect(data.guardrails).toEqual([])
      expect(Array.isArray(data.pending_candidates)).toBe(true)
    })
  })

  describe('POST /api/reflect/promote - Promote Candidate', () => {
    let metisCandidateId: string
    let guardrailCandidateId: string

    beforeAll(async () => {
      // Create metis candidate
      const metisResponse = await harness.makeRequestWithKey('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          type: 'metis',
          endeavor_id: testEndeavorId,
          content: 'Expected deployment to be straightforward, but encountered config drift'
        })
      }, process.env.TEST_API_KEY_1!)
      const metisData = await metisResponse.json()
      metisCandidateId = metisData.candidate_id

      // Create guardrail candidate
      const guardrailResponse = await harness.makeRequestWithKey('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          type: 'guardrail',
          endeavor_id: testEndeavorId,
          content: 'All deployments should have rollback plan'
        })
      }, process.env.TEST_API_KEY_1!)
      const guardrailData = await guardrailResponse.json()
      guardrailCandidateId = guardrailData.candidate_id
    })

    test('should promote metis candidate with structured fields', async () => {
      const response = await harness.makeRequestWithKey('/api/reflect/promote', {
        method: 'POST',
        body: JSON.stringify({
          candidate_id: metisCandidateId,
          type: 'metis',
          title: 'Config Drift Discovery',
          violated_expectation: 'Expected deployment environments to be in sync',
          observed_reality: 'Production had 3 config values different from staging',
          consequence: 'Deployment rollback required, 2 hours of debugging'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.promoted_id).toBeTruthy()
      expect(data.type).toBe('metis')
    })

    test('should reject metis promotion without required fields', async () => {
      // Create another candidate for this test
      const candResponse = await harness.makeRequestWithKey('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          type: 'metis',
          endeavor_id: testEndeavorId,
          content: 'Another metis candidate'
        })
      }, process.env.TEST_API_KEY_1!)
      const { candidate_id } = await candResponse.json()

      const response = await harness.makeRequestWithKey('/api/reflect/promote', {
        method: 'POST',
        body: JSON.stringify({
          candidate_id,
          type: 'metis',
          title: 'Incomplete Metis'
          // Missing: violated_expectation, observed_reality, consequence
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('violated_expectation')
    })

    test('should promote guardrail candidate with override protocol', async () => {
      const response = await harness.makeRequestWithKey('/api/reflect/promote', {
        method: 'POST',
        body: JSON.stringify({
          candidate_id: guardrailCandidateId,
          type: 'guardrail',
          title: 'Rollback Plan Required',
          description: 'Every deployment must have documented rollback steps',
          severity: 'soft',
          enforcement: 'require_rationale',
          override_protocol: 'Tech lead approval with documented emergency reason'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.promoted_id).toBeTruthy()
      expect(data.type).toBe('guardrail')
    })
  })

  describe('POST /api/reflect/reject - Reject Candidate', () => {
    test('should mark candidate as rejected with reason', async () => {
      // Create a candidate to reject
      const candResponse = await harness.makeRequestWithKey('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          type: 'metis',
          endeavor_id: testEndeavorId,
          content: 'Candidate to be rejected'
        })
      }, process.env.TEST_API_KEY_1!)
      const { candidate_id } = await candResponse.json()

      const response = await harness.makeRequestWithKey('/api/reflect/reject', {
        method: 'POST',
        body: JSON.stringify({
          candidate_id,
          type: 'metis',
          reason: 'Too generic, sounds like advice rather than observation'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.candidate_id).toBe(candidate_id)
    })

    test('should require rejection reason', async () => {
      const candResponse = await harness.makeRequestWithKey('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          type: 'metis',
          endeavor_id: testEndeavorId,
          content: 'Another candidate'
        })
      }, process.env.TEST_API_KEY_1!)
      const { candidate_id } = await candResponse.json()

      const response = await harness.makeRequestWithKey('/api/reflect/reject', {
        method: 'POST',
        body: JSON.stringify({
          candidate_id,
          type: 'metis',
          reason: '' // Empty reason
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/reflect/complete - Complete Review Session', () => {
    test('should update last_reviewed_at on endeavor', async () => {
      const response = await harness.makeRequestWithKey('/api/reflect/complete', {
        method: 'POST',
        body: JSON.stringify({
          endeavor_id: testEndeavorId
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.endeavor_id).toBe(testEndeavorId)
      expect(data.last_reviewed_at).toBeTruthy()

      // Verify status now shows recent review
      const statusResponse = await harness.makeRequestWithKey(
        `/api/reflect/status/${testEndeavorId}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )
      const statusData = await statusResponse.json()

      expect(statusData.last_reviewed_at).toBeTruthy()
      expect(statusData.days_since_review).toBe(0)
    })
  })

  describe('POST /api/reflect/extract - Contract Validation', () => {
    test('should require endeavor_id', async () => {
      const response = await harness.makeRequestWithKey('/api/reflect/extract', {
        method: 'POST',
        body: JSON.stringify({
          // Missing endeavor_id
          include_children: true
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid')
    })

    test('should return 404 for non-existent endeavor', async () => {
      const response = await harness.makeRequestWithKey('/api/reflect/extract', {
        method: 'POST',
        body: JSON.stringify({
          endeavor_id: '00000000-0000-0000-0000-000000000000'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(404)
    })

    test('should return empty candidates when no logs exist', async () => {
      // Create a fresh endeavor with no logs
      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Empty Endeavor for Extract Test',
          type: 'task'
        })
      }, process.env.TEST_API_KEY_1!)

      const { endeavorId } = await createResponse.json()

      const response = await harness.makeRequestWithKey('/api/reflect/extract', {
        method: 'POST',
        body: JSON.stringify({
          endeavor_id: endeavorId,
          include_children: false,
          include_parent: false,
          include_siblings: false
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.candidates_created).toBe(0)
      expect(data.candidates).toEqual([])
      expect(data.logs_processed).toBe(0)
    })
  })

  describe('GET /api/reflect/tree/[endeavorId] - Candidate Tree', () => {
    let missionId: string
    let aimId: string
    let initiativeId: string

    beforeAll(async () => {
      // Create a hierarchy: Mission -> Aim -> Initiative
      const missionResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Mission for Tree',
          type: 'mission'
        })
      }, process.env.TEST_API_KEY_1!)
      const missionData = await missionResponse.json()
      missionId = missionData.endeavorId

      const aimResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Aim under Mission',
          type: 'aim',
          parentId: missionId
        })
      }, process.env.TEST_API_KEY_1!)
      const aimData = await aimResponse.json()
      aimId = aimData.endeavorId

      const initiativeResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Initiative under Aim',
          type: 'initiative',
          parentId: aimId
        })
      }, process.env.TEST_API_KEY_1!)
      const initiativeData = await initiativeResponse.json()
      initiativeId = initiativeData.endeavorId

      // Add candidates to different levels
      await harness.makeRequestWithKey('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          type: 'metis',
          endeavor_id: aimId,
          content: 'Candidate on aim level'
        })
      }, process.env.TEST_API_KEY_1!)

      await harness.makeRequestWithKey('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          type: 'guardrail',
          endeavor_id: initiativeId,
          content: 'Candidate on initiative level'
        })
      }, process.env.TEST_API_KEY_1!)

      await harness.makeRequestWithKey('/api/candidates', {
        method: 'POST',
        body: JSON.stringify({
          type: 'metis',
          endeavor_id: initiativeId,
          content: 'Second candidate on initiative level'
        })
      }, process.env.TEST_API_KEY_1!)
    })

    test('should return candidates from all descendants', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/reflect/tree/${missionId}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.total_pending).toBe(3)
      expect(data.endeavors_with_candidates).toHaveLength(2) // aim and initiative

      // Check structure
      const endeavorIds = data.endeavors_with_candidates.map((e: { endeavor: { id: string } }) => e.endeavor.id)
      expect(endeavorIds).toContain(aimId)
      expect(endeavorIds).toContain(initiativeId)
    })

    test('should return empty array when no descendants have candidates', async () => {
      // Create isolated endeavor with no children
      const isolatedResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Isolated Endeavor',
          type: 'mission'
        })
      }, process.env.TEST_API_KEY_1!)
      const { endeavorId: isolatedId } = await isolatedResponse.json()

      const response = await harness.makeRequestWithKey(
        `/api/reflect/tree/${isolatedId}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.total_pending).toBe(0)
      expect(data.endeavors_with_candidates).toEqual([])
    })

    test('should filter by since parameter', async () => {
      // Use a future date to get no results
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      const sinceParam = futureDate.toISOString().split('T')[0]

      const response = await harness.makeRequestWithKey(
        `/api/reflect/tree/${missionId}?since=${sinceParam}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.total_pending).toBe(0)
    })

    test('should include endeavor metadata in response', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/reflect/tree/${missionId}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const data = await response.json()

      // Each endeavor entry should have full metadata
      const aimEntry = data.endeavors_with_candidates.find(
        (e: { endeavor: { id: string } }) => e.endeavor.id === aimId
      )
      expect(aimEntry).toBeTruthy()
      expect(aimEntry.endeavor.title).toBe('Test Aim under Mission')
      expect(aimEntry.endeavor.node_type.toLowerCase()).toBe('aim')
      expect(aimEntry.pending_count).toBe(1)
      expect(Array.isArray(aimEntry.candidates)).toBe(true)
    })
  })

  // LLM-dependent tests - skipped by default
  describe('POST /api/reflect/extract - LLM Extraction', () => {
    const shouldRunLLMTests = process.env.TEST_LLM_PROMPTS === 'true'

    beforeAll(() => {
      if (!shouldRunLLMTests) {
        console.log('🔧 LLM extraction tests skipped - set TEST_LLM_PROMPTS=true to enable')
      }
    })

    const testFn = shouldRunLLMTests ? test : test.skip

    testFn('should extract candidates from logs', async () => {
      // Create some logs first
      await harness.makeRequestWithKey('/api/logs', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'endeavor',
          entity_id: testEndeavorId,
          content: 'Deployed new feature. Expected it to take 1 hour but took 4 hours due to unexpected dependency conflicts. Had to manually resolve package versions.',
          log_date: new Date().toISOString().split('T')[0]
        })
      }, process.env.TEST_API_KEY_1!)

      const response = await harness.makeRequestWithKey('/api/reflect/extract', {
        method: 'POST',
        body: JSON.stringify({
          endeavor_id: testEndeavorId,
          include_children: false,
          include_parent: false,
          include_siblings: false
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.logs_processed).toBeGreaterThan(0)
      expect(Array.isArray(data.candidates)).toBe(true)
    }, 120000) // Long timeout for LLM
  })
})
