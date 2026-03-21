/**
 * API tests for edges (relationships between endeavors)
 *
 * This tests the unified graph model where all relationships (including parent-child)
 * are stored as edges. The `parent_id` column is deprecated in favor of edges.
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('Edges API Tests', () => {
  const harness = new ApiTestHarness({ port: 0 })

  // Store created endeavor IDs for cleanup and test references
  let user1MissionId: string
  let user1AimId: string
  let user1InitiativeId: string
  let user2MissionId: string

  // For cross-context testing
  let sharedContextId: string
  let sharedMissionId: string

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 Edges test environment validated')

    await harness.startApp()
    await harness.waitForReady()
    await harness.ensureTestUsersExist()

    // Create test hierarchy for user 1
    const missionResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Mission for Edges', type: 'mission' })
    }, process.env.TEST_API_KEY_1!)
    const missionResult = await missionResponse.json()
    user1MissionId = missionResult.endeavorId
    console.log('✅ Created user1 mission:', user1MissionId)

    const aimResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Aim for Edges', type: 'aim', parentId: user1MissionId })
    }, process.env.TEST_API_KEY_1!)
    const aimResult = await aimResponse.json()
    user1AimId = aimResult.endeavorId
    console.log('✅ Created user1 aim:', user1AimId)

    const initiativeResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Initiative for Edges', type: 'initiative', parentId: user1AimId })
    }, process.env.TEST_API_KEY_1!)
    const initiativeResult = await initiativeResponse.json()
    user1InitiativeId = initiativeResult.endeavorId
    console.log('✅ Created user1 initiative:', user1InitiativeId)

    // Create mission for user 2
    const user2Response = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'User 2 Mission for Edges', type: 'mission' })
    }, process.env.TEST_API_KEY_2!)
    const user2Result = await user2Response.json()
    user2MissionId = user2Result.endeavorId
    console.log('✅ Created user2 mission:', user2MissionId)

    // Create a shared context and mission for cross-context testing
    const contextResponse = await harness.makeRequestWithKey('/api/contexts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Shared Context for Edge Tests' })
    }, process.env.TEST_API_KEY_1!)
    const contextResult = await contextResponse.json()
    sharedContextId = contextResult.contextId
    console.log('✅ Created shared context:', sharedContextId)

    const sharedMissionResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Shared Mission for Edge Tests',
        type: 'mission',
        contextId: sharedContextId
      })
    }, process.env.TEST_API_KEY_1!)
    const sharedMissionResult = await sharedMissionResponse.json()
    sharedMissionId = sharedMissionResult.endeavorId
    console.log('✅ Created shared mission:', sharedMissionId)

  }, 180000)

  afterAll(async () => {
    await harness.stopApp()
  }, 30000)

  describe('Edge Creation', () => {
    it('should create an edge between two endeavors', async () => {
      const response = await harness.makeRequestWithKey('/api/edges', {
        method: 'POST',
        body: JSON.stringify({
          fromEndeavorId: user1AimId,
          toEndeavorId: user1MissionId,
          relationship: 'relates_to'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(201)
      const result = await response.json()
      expect(result.edge).toBeDefined()
      expect(result.edge.from_endeavor_id).toBe(user1AimId)
      expect(result.edge.to_endeavor_id).toBe(user1MissionId)
      expect(result.edge.relationship).toBe('relates_to')
    })

    it('should create a "contains" edge (parent-child relationship)', async () => {
      // Create a new task under the initiative using edges
      const taskResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'Task created without parent', type: 'task' })
      }, process.env.TEST_API_KEY_1!)
      const taskResult = await taskResponse.json()
      const taskId = taskResult.endeavorId

      // Create contains edge
      const response = await harness.makeRequestWithKey('/api/edges', {
        method: 'POST',
        body: JSON.stringify({
          fromEndeavorId: user1InitiativeId,
          toEndeavorId: taskId,
          relationship: 'contains'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(201)
      const result = await response.json()
      expect(result.edge.relationship).toBe('contains')
    })

    it('should reject self-referencing edge', async () => {
      const response = await harness.makeRequestWithKey('/api/edges', {
        method: 'POST',
        body: JSON.stringify({
          fromEndeavorId: user1MissionId,
          toEndeavorId: user1MissionId,
          relationship: 'relates_to'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.error).toContain('self')
    })

    it('should reject edge to endeavor user cannot access', async () => {
      // User 1 tries to create edge to user 2's mission
      const response = await harness.makeRequestWithKey('/api/edges', {
        method: 'POST',
        body: JSON.stringify({
          fromEndeavorId: user1MissionId,
          toEndeavorId: user2MissionId,
          relationship: 'relates_to'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(404)
      const result = await response.json()
      expect(result.error).toContain('not found')
    })
  })

  describe('Cross-Context Edges', () => {
    it('should allow edge between personal and shared context endeavors', async () => {
      // User 1 creates edge from personal mission to shared mission
      const response = await harness.makeRequestWithKey('/api/edges', {
        method: 'POST',
        body: JSON.stringify({
          fromEndeavorId: user1MissionId,
          toEndeavorId: sharedMissionId,
          relationship: 'relates_to'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(201)
      const result = await response.json()
      expect(result.edge.from_endeavor_id).toBe(user1MissionId)
      expect(result.edge.to_endeavor_id).toBe(sharedMissionId)
    })
  })

  describe('Edge Queries', () => {
    it('should get all edges for an endeavor', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/edges?endeavorId=${encodeURIComponent(user1MissionId)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(Array.isArray(result.edges)).toBe(true)
      // Should have at least the contains edge to aim
      expect(result.edges.length).toBeGreaterThan(0)
    })

    it('should filter edges by relationship type', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/edges?endeavorId=${encodeURIComponent(user1MissionId)}&relationship=contains`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(Array.isArray(result.edges)).toBe(true)
      // All edges should be 'contains' type
      for (const edge of result.edges) {
        expect(edge.relationship).toBe('contains')
      }
    })

    it('should get children via contains edges', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/edges?endeavorId=${encodeURIComponent(user1MissionId)}&relationship=contains&direction=outgoing`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(Array.isArray(result.edges)).toBe(true)
      // Should have aim as child
      const childIds = result.edges.map((e: any) => e.to_endeavor_id)
      expect(childIds).toContain(user1AimId)
    })

    it('should get parent via contains edges', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/edges?endeavorId=${encodeURIComponent(user1AimId)}&relationship=contains&direction=incoming`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(Array.isArray(result.edges)).toBe(true)
      // Should have mission as parent
      const parentIds = result.edges.map((e: any) => e.from_endeavor_id)
      expect(parentIds).toContain(user1MissionId)
    })
  })

  describe('Edge Deletion', () => {
    it('should delete an edge', async () => {
      // First create an edge to delete
      const createResponse = await harness.makeRequestWithKey('/api/edges', {
        method: 'POST',
        body: JSON.stringify({
          fromEndeavorId: user1InitiativeId,
          toEndeavorId: user1MissionId,
          relationship: 'references'
        })
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(201)
      const createResult = await createResponse.json()
      const edgeId = createResult.edge.id

      // Delete the edge
      const deleteResponse = await harness.makeRequestWithKey(
        `/api/edges/${edgeId}`,
        { method: 'DELETE' },
        process.env.TEST_API_KEY_1!
      )

      expect(deleteResponse.status).toBe(200)
    })
  })

  describe('Backward Compatibility - Parent API', () => {
    it('should still work with parent change API (uses edges internally)', async () => {
      // Create a new aim without parent
      const aimResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'Orphan Aim for Edge Compat', type: 'aim' })
      }, process.env.TEST_API_KEY_1!)
      const aimResult = await aimResponse.json()
      const orphanAimId = aimResult.endeavorId

      // Set parent using existing parent API
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(orphanAimId)}/parent`,
        {
          method: 'PUT',
          body: JSON.stringify({ parentId: user1MissionId })
        },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)

      // Verify via edges query
      const edgesResponse = await harness.makeRequestWithKey(
        `/api/edges?endeavorId=${encodeURIComponent(orphanAimId)}&relationship=contains&direction=incoming`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(edgesResponse.status).toBe(200)
      const edgesResult = await edgesResponse.json()
      const parentIds = edgesResult.edges.map((e: any) => e.from_endeavor_id)
      expect(parentIds).toContain(user1MissionId)
    })

    it('should return parent_id in endeavor response (computed from edges)', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(user1AimId)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      // parent_id should still be present (computed from contains edge)
      expect(result.endeavor.parent_id).toBe(user1MissionId)
    })
  })
})
