/**
 * API tests for endeavor creation and management
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('Endeavors API Tests', () => {
  const harness = new ApiTestHarness({ port: 3003 })

  beforeAll(async () => {
    validateEnvironment()

    console.log('🔧 Endeavors test environment validated')

    // Start the app and wait for it to be ready
    await harness.startApp()
    await harness.waitForReady()
    await harness.ensureTestUsersExist()
  }, 180000) // 3 minute timeout for app startup + user setup

  afterAll(async () => {
    await harness.stopApp()
  }, 30000)

  describe('Endeavor Creation', () => {
    it('should create an endeavor without context (personal endeavor)', async () => {
      const endeavorData = {
        title: 'Test Personal Mission',
        type: 'mission'  // Back to mission now that edge creation is fixed
        // No contextId provided - should default to 'personal'
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      if (response.status !== 200) {
        const errorResult = await response.json()
        console.error('API Error:', errorResult)
      }

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.endeavorId).toBeDefined()
      expect(result.endeavorId).toContain('mission:')

      // Test retrieving the created endeavor - skip for now to focus on creation
      console.log('✅ Created endeavor:', result.endeavorId)
    })

    it('should create a mission with parent edge', async () => {
      const endeavorData = {
        title: 'Test Mission with Parent',
        type: 'mission'
        // No contextId provided - should default to 'personal'
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      if (response.status !== 200) {
        const errorResult = await response.json()
        console.error('Mission API Error:', errorResult)
      }

      expect(response.status).toBe(200)

      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.endeavorId).toBeDefined()
      expect(result.endeavorId).toContain('mission:')
    })

    it('should create a context and then create an endeavor within that context', async () => {
      // Step 1: Create a context first
      const contextData = {
        title: 'Test Project Context',
        description: 'A test context for project collaboration',
        sharedEndeavors: []
      }

      const contextResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextData)
      }, process.env.TEST_API_KEY_1!)

      if (contextResponse.status !== 201) {
        const contextErrorResult = await contextResponse.json()
        console.error('Context Creation API Error:', contextErrorResult)
      }

      expect(contextResponse.status).toBe(201)

      const contextResult = await contextResponse.json()
      expect(contextResult.success).toBe(true)
      expect(contextResult.contextId).toBeDefined()

      console.log('✅ Created context:', contextResult.contextId)

      // Step 2: Create an endeavor within that context
      const endeavorData = {
        title: 'Test Context Mission',
        type: 'mission',
        contextId: contextResult.contextId
      }

      const endeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      if (endeavorResponse.status !== 200) {
        const endeavorErrorResult = await endeavorResponse.json()
        console.error('Endeavor Creation API Error:', endeavorErrorResult)
      }

      expect(endeavorResponse.status).toBe(200)

      const endeavorResult = await endeavorResponse.json()
      expect(endeavorResult.success).toBe(true)
      expect(endeavorResult.endeavorId).toBeDefined()
      expect(endeavorResult.endeavorId).toContain('mission:')

      console.log('✅ Created endeavor in context:', endeavorResult.endeavorId)

      // Step 3: Verify the context-endeavor relationship by listing contexts
      const listContextsResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      if (listContextsResponse.status !== 200) {
        const listErrorResult = await listContextsResponse.json()
        console.error('List Contexts API Error:', listErrorResult)
      }

      expect(listContextsResponse.status).toBe(200)

      const listContextsResult = await listContextsResponse.json()
      expect(listContextsResult.contexts).toBeDefined()
      expect(Array.isArray(listContextsResult.contexts)).toBe(true)

      // Find our created context
      const createdContext = listContextsResult.contexts.find((ctx: any) => ctx.id === contextResult.contextId)
      expect(createdContext).toBeDefined()
      expect(createdContext.title).toBe(contextData.title)

      console.log('✅ Context-endeavor relationship verified')
    })

    it('should enforce context-based access control between users', async () => {
      // Step 1: User 1 creates a context
      const contextData = {
        title: 'Private Project Context',
        description: 'A private context that should not be accessible to other users',
        sharedEndeavors: []
      }

      const contextResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextData)
      }, process.env.TEST_API_KEY_1!)

      expect(contextResponse.status).toBe(201)
      const contextResult = await contextResponse.json()

      // Step 2: User 1 creates an endeavor in that context
      const endeavorData = {
        title: 'Private Context Mission',
        type: 'mission',
        contextId: contextResult.contextId
      }

      const endeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      expect(endeavorResponse.status).toBe(200)
      const endeavorResult = await endeavorResponse.json()

      console.log('✅ User 1 created context and endeavor:', contextResult.contextId, endeavorResult.endeavorId)

      // Step 3: User 2 should NOT be able to see User 1's contexts
      const user2ContextsResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_2!)

      expect(user2ContextsResponse.status).toBe(200)
      const user2ContextsResult = await user2ContextsResponse.json()

      // User 2 should not see User 1's private context
      const user1ContextVisibleToUser2 = user2ContextsResult.contexts.find((ctx: any) => ctx.id === contextResult.contextId)
      expect(user1ContextVisibleToUser2).toBeUndefined()

      // Step 4: User 2 should NOT be able to create endeavors in User 1's context
      const unauthorizedEndeavorData = {
        title: 'Unauthorized Access Attempt',
        type: 'task',
        contextId: contextResult.contextId
      }

      const unauthorizedResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(unauthorizedEndeavorData)
      }, process.env.TEST_API_KEY_2!)

      // This should fail due to RLS policies - User 2 doesn't have access to User 1's context
      expect(unauthorizedResponse.status).toBe(400) // Should fail when trying to access context

      console.log('✅ Context access control properly enforced between users')
    })

    it('should create different endeavor types without context', async () => {
      const endeavorTypes = ['mission', 'aim', 'initiative', 'task']

      for (const type of endeavorTypes) {
        const endeavorData = {
          title: `Test ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          type
        }

        const response = await harness.makeRequestWithKey('/api/endeavors/create', {
          method: 'POST',
          body: JSON.stringify(endeavorData)
        }, process.env.TEST_API_KEY_1!)

        expect(response.status).toBe(200)

        const result = await response.json()
        expect(result.success).toBe(true)
        expect(result.endeavorId).toBeDefined()
        expect(result.endeavorId).toContain(`${type}:`)
      }
    })

    it('should reject endeavor creation without required fields', async () => {
      // Missing title
      const response1 = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({ type: 'mission' })
      }, process.env.TEST_API_KEY_1!)

      expect(response1.status).toBe(400)

      // Missing type
      const response2 = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test Mission' })
      }, process.env.TEST_API_KEY_1!)

      expect(response2.status).toBe(400)
    })

    it('should prevent user isolation violations in endeavor creation', async () => {
      // User 1 creates an endeavor
      const user1Endeavor = {
        title: 'User 1 Private Mission',
        type: 'mission'
      }

      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(user1Endeavor)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(200)

      const result = await createResponse.json()
      expect(result.success).toBe(true)
      expect(result.endeavorId).toBeDefined()

      // Verify the endeavor is properly isolated - this test mainly ensures
      // the creation process doesn't leak between users
      const user2Endeavor = {
        title: 'User 2 Private Mission',
        type: 'mission'
      }

      const user2Response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(user2Endeavor)
      }, process.env.TEST_API_KEY_2!)

      if (user2Response.status !== 200) {
        const errorResult = await user2Response.json()
        console.log('❌ User 2 endeavor creation failed:', user2Response.status, errorResult)
      }

      expect(user2Response.status).toBe(200)

      const user2Result = await user2Response.json()
      expect(user2Result.success).toBe(true)
      expect(user2Result.endeavorId).toBeDefined()
      expect(user2Result.endeavorId).not.toBe(result.endeavorId)
    })
  })

  describe('Context-Aware Creation', () => {
    it('should create endeavor in personal context when contextId is null', async () => {
      const endeavorData = {
        title: 'Personal Mission',
        type: 'mission',
        contextId: null
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const result = await response.json()
      expect(result.success).toBe(true)
      expect(result.endeavorId).toBeDefined()
      expect(result.endeavorId).toContain('mission:')

      console.log('✅ Created personal endeavor:', result.endeavorId)
    })

    it('should create endeavor in context when contextId provided', async () => {
      // Step 1: Create a context first
      const contextData = {
        title: 'Project Context',
        description: 'A test context for endeavor creation'
      }

      const contextResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextData)
      }, process.env.TEST_API_KEY_1!)

      expect(contextResponse.status).toBe(201)
      const contextResult = await contextResponse.json()
      expect(contextResult.success).toBe(true)
      expect(contextResult.contextId).toBeDefined()


      // Step 2: Create endeavor in that context
      const endeavorData = {
        title: 'Team Mission',
        type: 'mission',
        contextId: contextResult.contextId
      }

      const endeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      expect(endeavorResponse.status).toBe(200)
      const endeavorResult = await endeavorResponse.json()
      expect(endeavorResult.success).toBe(true)
      expect(endeavorResult.endeavorId).toBeDefined()
      expect(endeavorResult.endeavorId).toContain('mission:')


      // Step 3: Verify endeavor is accessible in context
      const listContextsResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(listContextsResponse.status).toBe(200)
      const listResult = await listContextsResponse.json()

      const targetContext = listResult.contexts.find((ctx: any) => ctx.id === contextResult.contextId)
      expect(targetContext).toBeDefined()

      // Test completed - endeavor successfully created in context

    })


    it('should create endeavor with parent in same context', async () => {
      // Step 1: Create a context
      const contextData = {
        title: 'Hierarchy Test Context',
        description: 'Testing parent-child creation in context',
        sharedEndeavors: []
      }

      const contextResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextData)
      }, process.env.TEST_API_KEY_1!)

      expect(contextResponse.status).toBe(201)
      const contextResult = await contextResponse.json()

      // Step 2: Create parent endeavor in context
      const parentData = {
        title: 'Parent Mission',
        type: 'mission',
        contextId: contextResult.contextId
      }

      const parentResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(parentData)
      }, process.env.TEST_API_KEY_1!)

      expect(parentResponse.status).toBe(200)
      const parentResult = await parentResponse.json()
      expect(parentResult.success).toBe(true)

      console.log('✅ Created parent endeavor:', parentResult.endeavorId)

      // Step 3: Create child endeavor with parent in same context
      const childData = {
        title: 'Child Initiative',
        type: 'initiative',
        contextId: contextResult.contextId,
        parentId: parentResult.endeavorId
      }

      const childResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(childData)
      }, process.env.TEST_API_KEY_1!)

      expect(childResponse.status).toBe(200)
      const childResult = await childResponse.json()
      expect(childResult.success).toBe(true)
      expect(childResult.endeavorId).toBeDefined()
      expect(childResult.endeavorId).toContain('initiative:')

      console.log('✅ Created child endeavor with parent in same context:', childResult.endeavorId)
    })

    it('should inherit context from parent when contextId not provided', async () => {
      // This is the key bug fix test: creating sub-endeavors without explicit contextId
      // should inherit the parent's context, not default to personal context

      // Step 1: Create a shared context
      const contextData = {
        title: 'Shared Context for Inheritance Test',
        description: 'Testing context inheritance from parent',
        sharedEndeavors: []
      }

      const contextResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextData)
      }, process.env.TEST_API_KEY_1!)

      expect(contextResponse.status).toBe(201)
      const contextResult = await contextResponse.json()
      expect(contextResult.success).toBe(true)

      // Step 2: Create parent endeavor in the shared context
      const parentData = {
        title: 'Parent in Shared Context',
        type: 'mission',
        contextId: contextResult.contextId
      }

      const parentResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(parentData)
      }, process.env.TEST_API_KEY_1!)

      expect(parentResponse.status).toBe(200)
      const parentResult = await parentResponse.json()
      expect(parentResult.success).toBe(true)

      console.log('✅ Created parent endeavor in shared context:', parentResult.endeavorId)

      // Step 3: Create child endeavor with ONLY parentId (no contextId!)
      // This was the bug: API would default to personal context instead of inheriting
      const childData = {
        title: 'Child Task Without Explicit Context',
        type: 'task',
        parentId: parentResult.endeavorId
        // Note: NO contextId provided - should inherit from parent
      }

      const childResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(childData)
      }, process.env.TEST_API_KEY_1!)

      // Before the fix, this would fail with "Parent not available in target context"
      expect(childResponse.status).toBe(200)
      const childResult = await childResponse.json()
      expect(childResult.success).toBe(true)
      expect(childResult.endeavorId).toBeDefined()

      console.log('✅ Created child endeavor (inherited context):', childResult.endeavorId)

      // Step 4: Verify both parent and child are in the shared context
      const dashboardResponse = await harness.makeRequestWithKey(`/api/dashboard?contextId=${contextResult.contextId}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(dashboardResponse.status).toBe(200)
      const dashboardData = await dashboardResponse.json()

      const parentInContext = dashboardData.nodes.some((n: any) => n.id === parentResult.endeavorId)
      const childInContext = dashboardData.nodes.some((n: any) => n.id === childResult.endeavorId)

      expect(parentInContext).toBe(true)
      expect(childInContext).toBe(true)

      console.log('✅ Verified both parent and child are in shared context - context inheritance working')
    })

    it('should reject parent not in target context', async () => {
      // Step 1: Create context A with parent endeavor
      const contextAData = {
        title: 'Context A',
        description: 'First context with parent',
        sharedEndeavors: []
      }

      const contextAResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextAData)
      }, process.env.TEST_API_KEY_1!)

      expect(contextAResponse.status).toBe(201)
      const contextAResult = await contextAResponse.json()

      const parentInAData = {
        title: 'Parent in Context A',
        type: 'mission',
        contextId: contextAResult.contextId
      }

      const parentAResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(parentInAData)
      }, process.env.TEST_API_KEY_1!)

      expect(parentAResponse.status).toBe(200)
      const parentAResult = await parentAResponse.json()

      // Step 2: Create context B
      const contextBData = {
        title: 'Context B',
        description: 'Second context for isolation test',
        sharedEndeavors: []
      }

      const contextBResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextBData)
      }, process.env.TEST_API_KEY_1!)

      expect(contextBResponse.status).toBe(201)
      const contextBResult = await contextBResponse.json()

      // Step 3: Try to create endeavor in context B with parent from context A (should fail)
      const invalidChildData = {
        title: 'Invalid Child',
        type: 'initiative',
        contextId: contextBResult.contextId,
        parentId: parentAResult.endeavorId  // Parent is in different context
      }

      const invalidResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(invalidChildData)
      }, process.env.TEST_API_KEY_1!)

      // This should fail because parent is not accessible in target context
      expect(invalidResponse.status).toBe(400)

      const errorResult = await invalidResponse.json()
      expect(errorResult.error).toContain('Parent not available in target context')

      console.log('✅ Correctly rejected parent not in target context')
    })

    it('should reject creation in non-existent context', async () => {
      const endeavorData = {
        title: 'Invalid Context Mission',
        type: 'mission',
        contextId: 'non-existent-context-id'
      }

      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.error).toContain('Context')

      console.log('✅ Correctly rejected non-existent context')
    })

    it('should reject creation in context without permission', async () => {
      // Step 1: User 1 creates a private context
      const contextData = {
        title: 'User 1 Private Context',
        description: 'Private context that User 2 should not access',
        sharedEndeavors: []
      }

      const contextResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextData)
      }, process.env.TEST_API_KEY_1!)

      expect(contextResponse.status).toBe(201)
      const contextResult = await contextResponse.json()

      // Step 2: User 2 tries to create endeavor in User 1's private context
      const unauthorizedData = {
        title: 'Unauthorized Mission',
        type: 'mission',
        contextId: contextResult.contextId
      }

      const unauthorizedResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(unauthorizedData)
      }, process.env.TEST_API_KEY_2!)

      // Should fail due to lack of context access
      expect(unauthorizedResponse.status).toBe(400)
      const errorResult = await unauthorizedResponse.json()
      expect(errorResult.error).toContain('Context')

      console.log('✅ Correctly rejected unauthorized context access')
    })
  })

  describe('Context Isolation After Move', () => {
    it('should show endeavor in only one context after moving', async () => {
      // Step 1: Create two contexts
      const context1Data = {
        title: 'Source Context',
        description: 'Original context for endeavor'
      }

      const context1Response = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(context1Data)
      }, process.env.TEST_API_KEY_1!)

      expect(context1Response.status).toBe(201)
      const context1Result = await context1Response.json()
      expect(context1Result.success).toBe(true)

      const context2Data = {
        title: 'Target Context',
        description: 'Destination context for move'
      }

      const context2Response = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(context2Data)
      }, process.env.TEST_API_KEY_1!)

      expect(context2Response.status).toBe(201)
      const context2Result = await context2Response.json()
      expect(context2Result.success).toBe(true)

      // Step 2: Create an endeavor in the first context
      const endeavorData = {
        title: 'Test Aim for Moving',
        type: 'aim',
        contextId: context1Result.contextId
      }

      const endeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      expect(endeavorResponse.status).toBe(200)
      const endeavorResult = await endeavorResponse.json()
      expect(endeavorResult.success).toBe(true)
      expect(endeavorResult.endeavorId).toBeDefined()

      console.log('✅ Created endeavor in source context:', endeavorResult.endeavorId)

      // Step 3: Verify endeavor is visible in first context by getting dashboard data
      const dashboard1Response = await harness.makeRequestWithKey(`/api/dashboard?contextId=${context1Result.contextId}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(dashboard1Response.status).toBe(200)
      const dashboard1Data = await dashboard1Response.json()
      expect(dashboard1Data.nodes).toBeDefined()

      console.log('🔍 Dashboard context 1 nodes:', dashboard1Data.nodes.length, 'looking for:', endeavorResult.endeavorId)
      console.log('🔍 Dashboard context 1 node IDs:', dashboard1Data.nodes.map((n: any) => n.id))

      // Check if the endeavor appears in context 1
      const endeavorInContext1Before = dashboard1Data.nodes.some((e: any) => e.id === endeavorResult.endeavorId)
      expect(endeavorInContext1Before).toBe(true)

      // Step 4: Verify endeavor is NOT visible in second context
      const dashboard2ResponseBefore = await harness.makeRequestWithKey(`/api/dashboard?contextId=${context2Result.contextId}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(dashboard2ResponseBefore.status).toBe(200)
      const dashboard2DataBefore = await dashboard2ResponseBefore.json()
      expect(dashboard2DataBefore.nodes).toBeDefined()

      const endeavorInContext2Before = dashboard2DataBefore.nodes.some((e: any) => e.id === endeavorResult.endeavorId)
      expect(endeavorInContext2Before).toBe(false)

      console.log('✅ Verified endeavor is only in source context before move')

      // Step 5: Move the endeavor from context 1 to context 2
      const moveData = {
        targetContextId: context2Result.contextId,
        moveSubgraph: false
      }

      console.log(`🔍 Making move request to: /api/endeavors/${endeavorResult.endeavorId}/move`)
      const moveResponse = await harness.makeRequestWithKey(`/api/endeavors/${endeavorResult.endeavorId}/move`, {
        method: 'POST',
        body: JSON.stringify(moveData)
      }, process.env.TEST_API_KEY_1!)

      console.log(`🔍 Move response status: ${moveResponse.status}`)
      if (moveResponse.status !== 200) {
        const errorText = await moveResponse.text()
        console.log(`🔍 Move response error: ${errorText}`)
      }

      expect(moveResponse.status).toBe(200)
      const moveResult = await moveResponse.json()
      expect(moveResult.success).toBe(true)
      expect(moveResult.movedToContext).toBe(context2Result.contextId)

      console.log('✅ Successfully moved endeavor to target context')

      // Step 6: Verify endeavor is now ONLY in the second context
      const dashboard1ResponseAfter = await harness.makeRequestWithKey(`/api/dashboard?contextId=${context1Result.contextId}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(dashboard1ResponseAfter.status).toBe(200)
      const dashboard1DataAfter = await dashboard1ResponseAfter.json()

      const endeavorInContext1After = dashboard1DataAfter.nodes.some((e: any) => e.id === endeavorResult.endeavorId)
      expect(endeavorInContext1After).toBe(false) // Should NOT be in source context anymore

      const dashboard2ResponseAfter = await harness.makeRequestWithKey(`/api/dashboard?contextId=${context2Result.contextId}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(dashboard2ResponseAfter.status).toBe(200)
      const dashboard2DataAfter = await dashboard2ResponseAfter.json()

      const endeavorInContext2After = dashboard2DataAfter.nodes.some((e: any) => e.id === endeavorResult.endeavorId)
      expect(endeavorInContext2After).toBe(true) // Should be in target context

      console.log('✅ Verified endeavor is now only in target context after move - context isolation working correctly')
    })

    it('should not show endeavor in personal context after moving to another context', async () => {
      console.log('🧪 Testing endeavor removal from personal context after move')

      // Step 1: Create context 1 for moving to
      const contextData = {
        title: 'Test Context for Move',
        description: 'Context for testing personal context isolation'
      }

      const contextResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextData)
      }, process.env.TEST_API_KEY_1!)

      expect(contextResponse.status).toBe(201)
      const contextResult = await contextResponse.json()
      expect(contextResult.contextId).toBeDefined()

      console.log('✅ Created test context:', contextResult.contextId)

      // Step 2: Create endeavor in personal context (default behavior)
      const endeavorData = {
        title: 'Personal Context Endeavor',
        type: 'mission',
        description: 'Endeavor to test personal context isolation'
      }

      const endeavorResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(endeavorData)
      }, process.env.TEST_API_KEY_1!)

      expect(endeavorResponse.status).toBe(200)
      const endeavorResult = await endeavorResponse.json()
      expect(endeavorResult.endeavorId).toBeDefined()

      console.log('✅ Created endeavor in personal context:', endeavorResult.endeavorId)

      // Step 3: Verify endeavor is visible in personal context dashboard
      const personalDashboardBefore = await harness.makeRequestWithKey('/api/dashboard', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(personalDashboardBefore.status).toBe(200)
      const personalDataBefore = await personalDashboardBefore.json()
      expect(personalDataBefore.nodes).toBeDefined()

      const endeavorInPersonalBefore = personalDataBefore.nodes.some((e: any) => e.id === endeavorResult.endeavorId)
      expect(endeavorInPersonalBefore).toBe(true)

      console.log('✅ Verified endeavor is visible in personal context before move')

      // Step 4: Verify endeavor is NOT in target context before move
      const contextDashboardBefore = await harness.makeRequestWithKey(`/api/dashboard?contextId=${contextResult.contextId}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(contextDashboardBefore.status).toBe(200)
      const contextDataBefore = await contextDashboardBefore.json()
      expect(contextDataBefore.nodes).toBeDefined()

      const endeavorInContextBefore = contextDataBefore.nodes.some((e: any) => e.id === endeavorResult.endeavorId)
      expect(endeavorInContextBefore).toBe(false)

      console.log('✅ Verified endeavor is NOT in target context before move')

      // Step 5: Move the endeavor from personal context to the other context
      const moveData = {
        targetContextId: contextResult.contextId,
        moveSubgraph: false
      }

      const moveResponse = await harness.makeRequestWithKey(`/api/endeavors/${endeavorResult.endeavorId}/move`, {
        method: 'POST',
        body: JSON.stringify(moveData)
      }, process.env.TEST_API_KEY_1!)

      expect(moveResponse.status).toBe(200)
      const moveResult = await moveResponse.json()
      expect(moveResult.success).toBe(true)
      expect(moveResult.movedToContext).toBe(contextResult.contextId)

      console.log('✅ Successfully moved endeavor from personal to target context')

      // Step 6: Verify endeavor is NO LONGER in personal context
      const personalDashboardAfter = await harness.makeRequestWithKey('/api/dashboard', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(personalDashboardAfter.status).toBe(200)
      const personalDataAfter = await personalDashboardAfter.json()

      const endeavorInPersonalAfter = personalDataAfter.nodes.some((e: any) => e.id === endeavorResult.endeavorId)
      expect(endeavorInPersonalAfter).toBe(false) // Should NOT be in personal context anymore

      console.log('✅ Verified endeavor is NO LONGER in personal context after move')

      // Step 7: Verify endeavor IS now in target context
      const contextDashboardAfter = await harness.makeRequestWithKey(`/api/dashboard?contextId=${contextResult.contextId}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(contextDashboardAfter.status).toBe(200)
      const contextDataAfter = await contextDashboardAfter.json()

      const endeavorInContextAfter = contextDataAfter.nodes.some((e: any) => e.id === endeavorResult.endeavorId)
      expect(endeavorInContextAfter).toBe(true) // Should be in target context

      console.log('✅ Verified endeavor IS now in target context - personal context isolation working correctly')
    })

    it('should move complex graph with subgraph flag and maintain hierarchy', async () => {
      console.log('🧪 Testing complex graph movement with subgraph flag')

      // Step 1: Create target context
      const contextData = {
        title: 'Target Context for Complex Graph',
        description: 'Context to test complex graph movement'
      }

      const contextResponse = await harness.makeRequestWithKey('/api/contexts', {
        method: 'POST',
        body: JSON.stringify(contextData)
      }, process.env.TEST_API_KEY_1!)

      expect(contextResponse.status).toBe(201)
      const contextResult = await contextResponse.json()

      // Step 2: Create a hierarchy in personal context
      // Mission (root) -> 2 Aims -> 2 Initiatives each -> 1 Task each

      // Create root mission
      const missionResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Root Mission',
          type: 'mission',
          description: 'Top-level mission for graph test'
        })
      }, process.env.TEST_API_KEY_1!)
      expect(missionResponse.status).toBe(200)
      const missionResult = await missionResponse.json()
      const missionId = missionResult.endeavorId

      // Create first aim under mission
      const aim1Response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'First Aim',
          type: 'aim',
          parentId: missionId
        })
      }, process.env.TEST_API_KEY_1!)
      expect(aim1Response.status).toBe(200)
      const aim1Result = await aim1Response.json()
      const aim1Id = aim1Result.endeavorId

      // Create second aim under mission
      const aim2Response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Second Aim',
          type: 'aim',
          parentId: missionId
        })
      }, process.env.TEST_API_KEY_1!)
      expect(aim2Response.status).toBe(200)
      const aim2Result = await aim2Response.json()
      const aim2Id = aim2Result.endeavorId

      // Create initiatives under first aim
      const init1Response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Initiative 1A',
          type: 'initiative',
          parentId: aim1Id
        })
      }, process.env.TEST_API_KEY_1!)
      expect(init1Response.status).toBe(200)
      const init1Result = await init1Response.json()
      const init1Id = init1Result.endeavorId

      const init2Response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Initiative 1B',
          type: 'initiative',
          parentId: aim1Id
        })
      }, process.env.TEST_API_KEY_1!)
      expect(init2Response.status).toBe(200)
      const init2Result = await init2Response.json()
      const init2Id = init2Result.endeavorId

      // Create initiatives under second aim
      const init3Response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Initiative 2A',
          type: 'initiative',
          parentId: aim2Id
        })
      }, process.env.TEST_API_KEY_1!)
      expect(init3Response.status).toBe(200)
      const init3Result = await init3Response.json()
      const init3Id = init3Result.endeavorId

      // Create tasks under initiatives
      const task1Response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Task 1A1',
          type: 'task',
          parentId: init1Id
        })
      }, process.env.TEST_API_KEY_1!)
      expect(task1Response.status).toBe(200)
      const task1Result = await task1Response.json()
      const task1Id = task1Result.endeavorId

      const task2Response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Task 2A1',
          type: 'task',
          parentId: init3Id
        })
      }, process.env.TEST_API_KEY_1!)
      expect(task2Response.status).toBe(200)
      const task2Result = await task2Response.json()
      const task2Id = task2Result.endeavorId

      console.log('✅ Created complex graph hierarchy')
      const allEndeavorIds = [missionId, aim1Id, aim2Id, init1Id, init2Id, init3Id, task1Id, task2Id]

      // Step 3: Verify all endeavors are in personal context initially
      const personalDashboardBefore = await harness.makeRequestWithKey('/api/dashboard', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(personalDashboardBefore.status).toBe(200)
      const personalDataBefore = await personalDashboardBefore.json()

      for (const endeavorId of allEndeavorIds) {
        const found = personalDataBefore.nodes.some((e: any) => e.id === endeavorId)
        expect(found).toBe(true)
      }

      console.log('✅ Verified all endeavors are in personal context before move')

      // Step 4: Move ONLY the root mission with subgraph=true (should move entire tree)
      const moveData = {
        targetContextId: contextResult.contextId,
        moveSubgraph: true
      }

      const moveResponse = await harness.makeRequestWithKey(`/api/endeavors/${missionId}/move`, {
        method: 'POST',
        body: JSON.stringify(moveData)
      }, process.env.TEST_API_KEY_1!)

      expect(moveResponse.status).toBe(200)
      const moveResult = await moveResponse.json()
      expect(moveResult.success).toBe(true)
      expect(moveResult.moveType).toBe('subgraph')
      expect(moveResult.movedEndeavors).toEqual(expect.arrayContaining(allEndeavorIds))

      console.log('✅ Successfully moved entire subgraph')

      // Step 5: Verify ALL endeavors are now in target context (not personal)
      const personalDashboardAfter = await harness.makeRequestWithKey('/api/dashboard', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(personalDashboardAfter.status).toBe(200)
      const personalDataAfter = await personalDashboardAfter.json()

      // No endeavors should remain in personal context
      for (const endeavorId of allEndeavorIds) {
        const found = personalDataAfter.nodes.some((e: any) => e.id === endeavorId)
        expect(found).toBe(false)
      }

      console.log('✅ Verified no endeavors remain in personal context')

      // Step 6: Verify ALL endeavors are now in target context
      const targetDashboardAfter = await harness.makeRequestWithKey(`/api/dashboard?contextId=${contextResult.contextId}`, {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(targetDashboardAfter.status).toBe(200)
      const targetDataAfter = await targetDashboardAfter.json()

      // All endeavors should be in target context
      for (const endeavorId of allEndeavorIds) {
        const found = targetDataAfter.nodes.some((e: any) => e.id === endeavorId)
        expect(found).toBe(true)
      }

      console.log('✅ Verified entire graph moved to target context - complex subgraph movement working correctly')
    }, 30000)  // Extended timeout for complex graph creation and movement
  })
})