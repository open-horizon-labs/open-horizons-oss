/**
 * API tests for changing endeavor parent relationships
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('Parent Change API Tests', () => {
  const harness = new ApiTestHarness({ port: 0 })

  // Store created endeavor IDs for cleanup and test references
  let missionId: string
  let aimId: string
  let aim2Id: string
  let initiativeId: string

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 Parent change test environment validated')

    await harness.startApp()
    await harness.waitForReady()
    await harness.ensureTestUsersExist()

    // Create test hierarchy: Mission -> Aim -> Initiative
    // Also create Aim2 as sibling (no parent initially)

    // Create Mission
    const missionResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Mission for Parent Change', type: 'mission' })
    }, process.env.TEST_API_KEY_1!)
    const missionResult = await missionResponse.json()
    missionId = missionResult.endeavorId
    console.log('✅ Created mission:', missionId)

    // Create Aim under Mission
    const aimResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Aim with Parent', type: 'aim', parentId: missionId })
    }, process.env.TEST_API_KEY_1!)
    const aimResult = await aimResponse.json()
    aimId = aimResult.endeavorId
    console.log('✅ Created aim:', aimId)

    // Create orphan Aim (no parent)
    const aim2Response = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'Orphan Aim', type: 'aim' })
    }, process.env.TEST_API_KEY_1!)
    const aim2Result = await aim2Response.json()
    aim2Id = aim2Result.endeavorId
    console.log('✅ Created orphan aim:', aim2Id)

    // Create Initiative under Aim
    const initiativeResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Initiative', type: 'initiative', parentId: aimId })
    }, process.env.TEST_API_KEY_1!)
    const initiativeResult = await initiativeResponse.json()
    initiativeId = initiativeResult.endeavorId
    console.log('✅ Created initiative:', initiativeId)

  }, 180000)

  afterAll(async () => {
    await harness.stopApp()
  }, 30000)

  describe('Setting Parent', () => {
    it('should set parent on orphan aim (Aim -> Mission)', async () => {
      // aim2Id currently has no parent, set it to missionId
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aim2Id)}/parent`,
        {
          method: 'PUT',
          body: JSON.stringify({ parentId: missionId })
        },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)

      // Verify the parent was set
      const getResponse = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aim2Id)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )
      expect(getResponse.status).toBe(200)
      const endeavor = await getResponse.json()
      expect(endeavor.endeavor.parent_id).toBe(missionId)
    })

    it('should remove parent (set to root)', async () => {
      // aim2Id now has missionId as parent, remove it
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aim2Id)}/parent`,
        {
          method: 'PUT',
          body: JSON.stringify({ parentId: null })
        },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)

      // Verify the parent was removed
      const getResponse = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aim2Id)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )
      expect(getResponse.status).toBe(200)
      const endeavor = await getResponse.json()
      expect(endeavor.endeavor.parent_id).toBeNull()
    })

    it('should handle "root" string to remove parent', async () => {
      // First set the parent again
      await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aim2Id)}/parent`,
        {
          method: 'PUT',
          body: JSON.stringify({ parentId: missionId })
        },
        process.env.TEST_API_KEY_1!
      )

      // Now remove using "root" string
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aim2Id)}/parent`,
        {
          method: 'PUT',
          body: JSON.stringify({ parentId: 'root' })
        },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)

      // Verify
      const getResponse = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aim2Id)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )
      const endeavor = await getResponse.json()
      expect(endeavor.endeavor.parent_id).toBeNull()
    })
  })

  describe('Validation', () => {
    it('should reject self-parenting', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aimId)}/parent`,
        {
          method: 'PUT',
          body: JSON.stringify({ parentId: aimId })
        },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.error).toContain('own parent')
    })

    it('should reject circular dependency (parent is descendant)', async () => {
      // Try to set aimId's parent to initiativeId (initiative is child of aim)
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aimId)}/parent`,
        {
          method: 'PUT',
          body: JSON.stringify({ parentId: initiativeId })
        },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.error).toContain('circular')
    })

    it('should reject non-existent parent', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aimId)}/parent`,
        {
          method: 'PUT',
          body: JSON.stringify({ parentId: 'non-existent-id-12345' })
        },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(404)
      const result = await response.json()
      expect(result.error).toContain('not found')
    })

    it('should reject parent from different user', async () => {
      // Create endeavor with user 2
      const user2Response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'User 2 Mission', type: 'mission' })
      }, process.env.TEST_API_KEY_2!)
      const user2Result = await user2Response.json()
      const user2MissionId = user2Result.endeavorId

      // Try to set user 1's aim parent to user 2's mission
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(aim2Id)}/parent`,
        {
          method: 'PUT',
          body: JSON.stringify({ parentId: user2MissionId })
        },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(404)
      const result = await response.json()
      expect(result.error).toContain('not found')
    })
  })
})
