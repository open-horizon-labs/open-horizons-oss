/**
 * Contract-First API Testing: Endeavors
 *
 * This test validates that the contract layer prevents schema drift
 * between API routes, database, and UI components.
 *
 * TEST STRATEGY:
 * 1. Validate API requests match contract
 * 2. Validate API responses match contract
 * 3. Validate UI can consume API responses without transformation
 * 4. Validate schema transformations work correctly
 * 5. Catch breaking changes before they reach production
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'
import {
  CreateEndeavorRequest,
  CreateEndeavorResponse,
  GraphNode,
  validateCreateEndeavorRequest,
  validateCreateEndeavorResponse,
  validateGraphNode,
  userToDbNodeType,
  dbToApiNodeType,
  UserNodeType,
  DatabaseNodeType,
  ApiNodeType,
  ContractViolationError
} from '../../lib/contracts/endeavor-contract'

describe('Contract Validation API Tests', () => {
  const harness = new ApiTestHarness({ port: 3003 })

  beforeAll(async () => {
    validateEnvironment()
    console.log('🔧 Contract validation test environment ready')
    await harness.startApp()
    await harness.waitForReady()
  }, 180000)

  afterAll(async () => {
    await harness.stopApp()
  }, 30000)

  describe('Contract Schema Consistency', () => {
    it('should enforce consistent node type transformations', () => {
      // Test all supported node types transform correctly
      const userTypes: UserNodeType[] = ['mission', 'aim', 'initiative', 'task', 'ritual', 'strength', 'achievement']
      const expectedDbTypes: DatabaseNodeType[] = ['Mission', 'Aim', 'Initiative', 'Task', 'Ritual', 'Strength', 'Achievement']

      userTypes.forEach((userType, index) => {
        const dbType = userToDbNodeType(userType)
        const apiType = dbToApiNodeType(dbType)

        expect(dbType).toBe(expectedDbTypes[index])
        expect(apiType).toBe(expectedDbTypes[index]) // API and DB formats are same
      })
    })

    it('should validate request contracts catch invalid input', () => {
      // Test invalid request data is caught by contract
      const invalidRequests = [
        { title: '', type: 'mission' }, // Empty title
        { title: 'Test', type: 'invalid' }, // Invalid type
        { title: 'Test', type: 'mission', contextId: 123 }, // Wrong contextId type
        { title: 'Test'.repeat(100), type: 'mission' } // Title too long
      ]

      invalidRequests.forEach(invalidReq => {
        expect(() => validateCreateEndeavorRequest(invalidReq))
          .toThrow(ContractViolationError)
      })
    })

    it('should validate response contracts catch invalid output', () => {
      // Test invalid response data is caught by contract
      const invalidResponses = [
        { success: true }, // Missing endeavorId
        { success: true, endeavorId: null }, // Null endeavorId
        { success: true, endeavorId: '' } // Empty endeavorId
      ]
      // Note: { success: false } actually passes validation since success is literal(true) only

      invalidResponses.forEach(invalidRes => {
        expect(() => validateCreateEndeavorResponse(invalidRes))
          .toThrow(ContractViolationError)
      })
    })
  })

  describe('End-to-End Contract Validation', () => {
    it('should create endeavor with full contract validation', async () => {
      // 1. Create valid request that matches contract
      const request: CreateEndeavorRequest = {
        title: 'Contract Test Mission',
        type: 'mission'
      }

      // 2. Validate request passes contract validation
      expect(() => validateCreateEndeavorRequest(request)).not.toThrow()

      // 3. Send request to API
      const response = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(request)
      }, process.env.TEST_API_KEY_1!)

      // 4. API should succeed
      expect(response.status).toBe(200)

      // 5. Parse and validate response matches contract
      const result = await response.json()
      let validatedResponse: CreateEndeavorResponse
      expect(() => {
        validatedResponse = validateCreateEndeavorResponse(result)
      }).not.toThrow()

      // 6. Response should contain expected data
      expect(validatedResponse!.success).toBe(true)
      expect(validatedResponse!.endeavorId).toContain('mission:')
    })

    it('should return GraphNodes that UI can consume without transformation', async () => {
      // This tests the critical requirement: UI should consume API responses directly

      // 1. Create an endeavor
      const createRequest: CreateEndeavorRequest = {
        title: 'UI Consumption Test',
        type: 'aim'  // Test a different type
      }

      const createResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
        method: 'POST',
        body: JSON.stringify(createRequest)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(200)

      // 2. Fetch dashboard (simulating UI consumption)
      const dashboardResponse = await harness.makeRequestWithKey('/api/dashboard', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(dashboardResponse.status).toBe(200)
      const dashboardData = await dashboardResponse.json()

      // 3. Find our created endeavor in the dashboard
      const createdEndeavor = dashboardData.nodes.find((n: any) =>
        n.title === 'UI Consumption Test'
      )
      expect(createdEndeavor).toBeDefined()

      // 4. CRITICAL: Validate GraphNode contract directly
      let validatedNode: GraphNode
      expect(() => {
        validatedNode = validateGraphNode(createdEndeavor)
      }).not.toThrow()

      // 5. UI expectations match exactly
      expect(validatedNode!.node_type).toBe('Aim') // Capitalized as expected
      expect(validatedNode!.title).toBe('UI Consumption Test')
      expect(validatedNode!.id).toContain('aim:')

      // 6. CRITICAL: UI toLowerCase() calls should work
      expect(validatedNode!.node_type.toLowerCase()).toBe('aim')
    })

    it('should detect schema drift if API returns unexpected format', async () => {
      // This test simulates what happens when API changes break the contract

      // Simulate a malformed GraphNode (like if API started returning different field names)
      const malformedGraphNode = {
        nodeId: 'test:123', // Wrong field name (should be 'id')
        nodeType: 'Mission', // Wrong field name (should be 'node_type')
        title: 'Test',
        description: 'Test',
        status: 'active',
        metadata: {},
        createdAt: '2023-01-01T00:00:00Z',
        archivedAt: null
      }

      // Contract validation should catch this
      expect(() => validateGraphNode(malformedGraphNode))
        .toThrow(ContractViolationError)

      // Should include helpful error details
      try {
        validateGraphNode(malformedGraphNode)
      } catch (error) {
        expect(error).toBeInstanceOf(ContractViolationError)
        // Should mention the missing required fields
        expect(error.message).toContain('GraphNode')
        expect(error.contractName).toBe('GraphNode')
      }
    })
  })

  describe('Real API Integration', () => {
    it('should validate API route returns data matching UI expectations', async () => {
      // Test EVERY node type to ensure consistent behavior
      const nodeTypes: UserNodeType[] = ['mission', 'aim', 'initiative', 'task']

      for (const nodeType of nodeTypes) {
        const request: CreateEndeavorRequest = {
          title: `Contract Test ${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}`,
          type: nodeType
        }

        const response = await harness.makeRequestWithKey('/api/endeavors/create', {
          method: 'POST',
          body: JSON.stringify(request)
        }, process.env.TEST_API_KEY_1!)

        expect(response.status).toBe(200)
        const result = await response.json()

        // Validate response contract
        const validatedResponse = validateCreateEndeavorResponse(result)
        expect(validatedResponse.success).toBe(true)
        expect(validatedResponse.endeavorId).toContain(`${nodeType}:`)
      }
    })

    it('should prevent regressions in UI component data consumption', async () => {
      // This test mirrors how UI components actually use the data

      const response = await harness.makeRequestWithKey('/api/dashboard', {
        method: 'GET'
      }, process.env.TEST_API_KEY_1!)

      expect(response.status).toBe(200)
      const dashboardData = await response.json()

      // Simulate UI component filtering (from DashboardClient.tsx)
      const nodes = dashboardData.nodes.map((node: any) => validateGraphNode(node))

      const missions = nodes.filter(n => n.node_type?.toLowerCase() === 'mission')
      const aims = nodes.filter(n => n.node_type?.toLowerCase() === 'aim')
      const initiatives = nodes.filter(n => n.node_type?.toLowerCase() === 'initiative')

      // These filters should work without throwing
      expect(Array.isArray(missions)).toBe(true)
      expect(Array.isArray(aims)).toBe(true)
      expect(Array.isArray(initiatives)).toBe(true)

      // Each node should have all required UI fields
      nodes.forEach(node => {
        expect(typeof node.id).toBe('string')
        expect(typeof node.node_type).toBe('string')
        expect(typeof node.title).toBe('string')
        expect(typeof node.created_at).toBe('string')
        // parent_id can be null, that's valid
        expect(node.hasOwnProperty('parent_id')).toBe(true)
      })
    })
  })
})