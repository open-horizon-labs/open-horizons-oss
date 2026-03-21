/**
 * Collaboration Integration Tests
 *
 * Tests the full collaboration flow:
 * 1. User creates a shared context
 * 2. User creates endeavors in that context
 * 3. User invites collaborator
 * 4. Collaborator accepts invitation
 * 5. Collaborator can access all shared endeavors
 *
 * This test requires two API keys for two different test users.
 * See apps/app/__tests__/api/README.md for setup instructions.
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll, test } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('Collaboration Flow', () => {
  const harness = new ApiTestHarness({ port: 3003 })

  // Track created resources for cleanup
  let sharedContextId: string | null = null
  let createdEndeavorIds: string[] = []

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 Collaboration test environment validated')

    // Start the app and wait for it to be ready
    await harness.startApp()
    await harness.waitForReady()
    await harness.ensureTestUsersExist()
  }, 180000)

  afterAll(async () => {
    // Cleanup: delete created endeavors and context
    // (optional, but good practice)
    if (createdEndeavorIds.length > 0) {
      for (const id of createdEndeavorIds.reverse()) {
        try {
          await harness.makeRequestWithKey(`/api/endeavors/${encodeURIComponent(id)}`, {
            method: 'DELETE'
          }, process.env.TEST_API_KEY_1!)
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    await harness.stopApp()
  }, 30000)

  describe('Full Collaboration Flow', () => {
    let parentEndeavorId: string
    let childEndeavorId: string
    let invitationToken: string

    it('Step 1: User 1 creates a shared context', async () => {
      const contextData = {
        title: 'Collaboration Test Context',
        description: 'Testing that collaborators can access all endeavors',
        sharedEndeavors: []
      }

      const response = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextData)
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(201)
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.contextId).toBeDefined()

      sharedContextId = result.contextId
      console.log('✅ Created shared context:', sharedContextId)
    })

    it('Step 2: User 1 creates a parent endeavor in shared context', async () => {
      expect(sharedContextId).toBeDefined()

      const endeavorData = {
        title: 'Parent Mission in Shared Context',
        type: 'mission',
        description: 'This should be visible to collaborators',
        contextId: sharedContextId
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.endeavorId).toBeDefined()

      parentEndeavorId = result.endeavorId
      createdEndeavorIds.push(parentEndeavorId)
      console.log('✅ Created parent endeavor:', parentEndeavorId)
    })

    it('Step 3: User 1 creates a child endeavor (inherits context)', async () => {
      expect(parentEndeavorId).toBeDefined()

      // Create child with only parentId - should inherit context
      const childData = {
        title: 'Child Initiative Under Parent',
        type: 'initiative',
        description: 'This child should also be visible to collaborators',
        parentId: parentEndeavorId
        // Note: NOT specifying contextId - should inherit from parent
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(childData)
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.endeavorId).toBeDefined()

      childEndeavorId = result.endeavorId
      createdEndeavorIds.push(childEndeavorId)
      console.log('✅ Created child endeavor:', childEndeavorId)
    })

    it('Step 4: Verify child endeavor inherited correct context', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(childEndeavorId)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.endeavor).toBeDefined()
      expect(result.endeavor.context_id).toBe(sharedContextId)

      console.log('✅ Child endeavor has correct context_id:', result.endeavor.context_id)
    })

    it('Step 5: User 2 cannot see shared context YET', async () => {
      const response = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_2!)

      expect(response.status).toBe(200)
      const result = await response.json()

      // User 2 should NOT see User 1's context yet
      const sharedContextVisible = result.contexts.some(
        (ctx: any) => ctx.id === sharedContextId
      )
      expect(sharedContextVisible).toBe(false)

      console.log('✅ User 2 correctly cannot see shared context before invitation')
    })

    it('Step 6: User 2 cannot access endeavors in shared context YET', async () => {
      // Try to access parent endeavor
      const parentResponse = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(parentEndeavorId)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_2!
      )
      expect(parentResponse.status).toBe(404)

      // Try to access child endeavor
      const childResponse = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(childEndeavorId)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_2!
      )
      expect(childResponse.status).toBe(404)

      console.log('✅ User 2 correctly cannot access endeavors before invitation')
    })

    it('Step 7: User 1 invites User 2 to the context', async () => {
      // Test users have hardcoded emails from setup-test-users.js
      const user2Email = 'test-user-2@example.com'
      console.log('📧 User 2 email:', user2Email)

      // Now create the invitation
      const inviteData = {
        inviteeEmail: user2Email,
        role: 'editor'
      }

      const inviteResponse = await harness.makeRequestWithKey(
        `/api/contexts/${encodeURIComponent(sharedContextId!)}/invitations`,
        {
          method: 'POST',
          body: JSON.stringify(inviteData)
        },
        process.env.TEST_API_KEY_1!
      )

      const inviteResult = await inviteResponse.json()
      if (inviteResponse.status !== 200) {
        console.error('❌ Invitation failed:', inviteResult)
      }
      expect(inviteResponse.status).toBe(200)
      expect(inviteResult.success).toBe(true)
      expect(inviteResult.token).toBeDefined()

      invitationToken = inviteResult.token
      console.log('✅ Invitation created with token:', invitationToken.substring(0, 10) + '...')
    })

    it('Step 8: User 2 accepts the invitation', async () => {
      expect(invitationToken).toBeDefined()

      const acceptResponse = await harness.makeRequestWithKey('/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: invitationToken })
      }, process.env.TEST_API_KEY_2!)

      expect(acceptResponse.status).toBe(200)
      const acceptResult = await acceptResponse.json()
      expect(acceptResult.success).toBe(true)
      expect(acceptResult.contextId).toBe(sharedContextId)

      console.log('✅ User 2 accepted invitation to context:', acceptResult.contextId)
    })

    it('Step 9: User 2 can NOW see the shared context', async () => {
      const response = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_2!)

      expect(response.status).toBe(200)
      const result = await response.json()

      // User 2 should NOW see User 1's context
      const sharedContextVisible = result.contexts.some(
        (ctx: any) => ctx.id === sharedContextId
      )
      expect(sharedContextVisible).toBe(true)

      console.log('✅ User 2 can now see shared context after accepting invitation')
    })

    it('Step 10: User 2 can access PARENT endeavor in shared context', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(parentEndeavorId)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_2!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.endeavor).toBeDefined()
      expect(result.endeavor.id).toBe(parentEndeavorId)
      expect(result.endeavor.title).toBe('Parent Mission in Shared Context')

      console.log('✅ User 2 can access parent endeavor:', parentEndeavorId)
    })

    it('Step 11: User 2 can access CHILD endeavor in shared context', async () => {
      // THIS IS THE KEY TEST - child endeavors must also be accessible
      const response = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(childEndeavorId)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_2!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.endeavor).toBeDefined()
      expect(result.endeavor.id).toBe(childEndeavorId)
      expect(result.endeavor.title).toBe('Child Initiative Under Parent')

      console.log('✅ User 2 can access child endeavor:', childEndeavorId)
    })

    it('Step 12: User 2 sees all endeavors in dashboard for shared context', async () => {
      const response = await harness.makeRequestWithKey(
        `/api/dashboard?contextId=${encodeURIComponent(sharedContextId!)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_2!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.nodes).toBeDefined()
      expect(Array.isArray(result.nodes)).toBe(true)

      // Should see both parent and child
      const nodeIds = result.nodes.map((n: any) => n.id)
      expect(nodeIds).toContain(parentEndeavorId)
      expect(nodeIds).toContain(childEndeavorId)

      console.log('✅ User 2 sees all endeavors in dashboard:', nodeIds.length, 'nodes')
    })
  })

  describe('Edge Cases', () => {
    it('Context owner can access endeavors without explicit membership', async () => {
      // The context owner (User 1) should be able to access endeavors
      // even without a context_memberships entry (via the contexts.created_by check)

      // This is covered implicitly by Steps 2-4, but let's be explicit
      expect(sharedContextId).toBeDefined()

      const response = await harness.makeRequestWithKey(
        `/api/dashboard?contextId=${encodeURIComponent(sharedContextId!)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_1!
      )

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.nodes.length).toBeGreaterThan(0)

      console.log('✅ Context owner can access all endeavors')
    })

    it('User 2 cannot access endeavors in User 1 PERSONAL context', async () => {
      // First, get User 1's personal context
      const contextsResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      const contexts = (await contextsResponse.json()).contexts
      const personalContext = contexts.find((c: any) => c.id.startsWith('personal:'))
      expect(personalContext).toBeDefined()

      // Create an endeavor in User 1's personal context
      const personalEndeavorData = {
        title: 'Private Endeavor in Personal Context',
        type: 'task',
        contextId: personalContext.id
      }

      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(personalEndeavorData)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(200)
      const created = await createResponse.json()
      createdEndeavorIds.push(created.endeavorId)

      // User 2 should NOT be able to access this
      const accessResponse = await harness.makeRequestWithKey(
        `/api/endeavors/${encodeURIComponent(created.endeavorId)}`,
        { method: 'GET' },
        process.env.TEST_API_KEY_2!
      )

      expect(accessResponse.status).toBe(404)
      console.log('✅ User 2 correctly cannot access User 1 personal context endeavors')
    })
  })
})
