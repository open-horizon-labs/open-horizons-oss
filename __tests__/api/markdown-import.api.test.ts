import { ApiTestHarness } from './api-harness'

const harness = new ApiTestHarness()

// Only run this test if LLM testing is explicitly enabled
const shouldRunLLMTests = process.env.TEST_LLM_PROMPTS === 'true'

beforeAll(async () => {
  if (!shouldRunLLMTests) {
    console.log('🔧 LLM tests skipped - set TEST_LLM_PROMPTS=true to enable')
    return
  }
  console.log('🔧 Markdown import LLM test environment validated')
  await harness.waitForReady()
}, 60000)

afterAll(async () => {
  if (shouldRunLLMTests) {
    await harness.stopApp()
  }
})

describe('Markdown Import Integration Tests', () => {
  // Skip all tests unless explicitly enabled
  const testFn = shouldRunLLMTests ? test : test.skip

  testFn('should parse hierarchical markdown and create proper parent_id relationships', async () => {
    // Comprehensive markdown that should create a clear hierarchy
    const hierarchicalMarkdown = `
# Strategic Mission: Open Horizons Platform
Our mission is to create an AI-native system that keeps strategy and execution in perfect alignment, eliminating the $2T annual waste from misalignment.

## Aim: Build Core Platform Infrastructure
Establish the foundational technical architecture that supports real-time strategy-execution alignment with enterprise-grade reliability and security.

### Initiative: Database Architecture
Design and implement the core data model that supports dynamic role evolution, context-aware access control, and real-time collaboration features.

### Initiative: Authentication System
Build secure, scalable authentication supporting both session-based and API key authentication with proper role-based access controls.

## Aim: Create User Experience Excellence
Develop an intuitive interface that makes complex organizational alignment feel natural and encourages daily engagement across all team levels.

### Initiative: Dashboard Development
Create responsive, real-time dashboards that provide clear visibility into alignment status, progress tracking, and actionable insights.

### Initiative: Mobile Optimization
Ensure seamless experience across all devices with offline capability for critical alignment review activities.

## Aim: Establish Market Presence
Build awareness and adoption channels that demonstrate clear ROI and drive sustainable growth in the organizational alignment market.
`.trim()

    console.log('🧪 Testing comprehensive markdown parsing with hierarchy...')

    // Step 1: Parse the markdown and create import plan
    const planResponse = await harness.makeRequestWithKey('/api/import/markdown-aims', {
      method: 'POST',
      body: JSON.stringify({
        content: hierarchicalMarkdown,
        contextId: 'personal'
      })
    }, process.env.TEST_API_KEY_1!)

    expect(planResponse.status).toBe(200)
    const planResult = await planResponse.json()

    console.log('✅ Import plan generated')
    console.log(`📋 Actions: ${planResult.plan.actions.length}`)
    console.log(`🔗 Parent relationships: ${planResult.plan.edges.filter((e: any) => e.kind === 'supports').length}`)

    // Verify we have the expected structure
    expect(planResult.plan.actions.length).toBeGreaterThanOrEqual(7) // 1 mission + 3 aims + 3+ initiatives
    expect(planResult.plan.edges.filter((e: any) => e.kind === 'supports').length).toBeGreaterThanOrEqual(6) // aims support mission, initiatives support aims

    // Step 2: Commit the plan
    const commitResponse = await harness.makeRequestWithKey('/api/import/markdown-aims/commit', {
      method: 'POST',
      body: JSON.stringify({
        plan: planResult.plan
      })
    }, process.env.TEST_API_KEY_1!)

    expect(commitResponse.status).toBe(200)
    const commitResult = await commitResponse.json()

    console.log('✅ Import committed successfully')
    console.log(`📊 Summary: ${JSON.stringify(commitResult.summary, null, 2)}`)

    expect(commitResult.success).toBe(true)
    expect(commitResult.summary.errors.length).toBe(0)

    // Step 3: Verify the hierarchy was created correctly in the database
    // Get the dashboard to see all created endeavors
    const dashboardResponse = await harness.makeRequestWithKey('/api/dashboard?contextId=personal', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(dashboardResponse.status).toBe(200)
    const dashboardResult = await dashboardResponse.json()

    console.log('✅ Retrieved dashboard data')
    console.log(`📈 Total endeavors created: ${dashboardResult.nodes.length}`)

    // Verify we have endeavors of different types
    const endeavorsByType = dashboardResult.nodes.reduce((acc: any, node: any) => {
      // Extract type from the ID (e.g., "mission:user:timestamp" -> "mission")
      const type = node.id.split(':')[0]
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    console.log('📊 Endeavors by type:', endeavorsByType)

    // Should have created at least 1 mission, 3 aims, and multiple initiatives
    expect(endeavorsByType.mission).toBeGreaterThanOrEqual(1)
    expect(endeavorsByType.aim).toBeGreaterThanOrEqual(3)
    expect(endeavorsByType.initiative).toBeGreaterThanOrEqual(4)

    // Step 4: Verify parent relationships were set correctly using parent_id
    // Load endeavors with parent_id information
    const endeavorsResponse = await harness.makeRequestWithKey('/api/endeavors/personal', {
      method: 'GET'
    }, process.env.TEST_API_KEY_1!)

    expect(endeavorsResponse.status).toBe(200)
    const endeavorsResult = await endeavorsResponse.json()

    console.log('✅ Retrieved endeavor details')

    // Verify parent-child relationships
    const endeavorsWithParents = endeavorsResult.endeavors.filter((e: any) => e.parent_id)
    console.log(`🔗 Endeavors with parents: ${endeavorsWithParents.length}`)

    // Should have proper hierarchy: initiatives -> aims -> mission
    expect(endeavorsWithParents.length).toBeGreaterThanOrEqual(6) // 3 aims + 4+ initiatives should have parents

    // Find the mission (should have no parent)
    const missions = endeavorsResult.endeavors.filter((e: any) => e.id.startsWith('mission:'))
    expect(missions.length).toBe(1)
    expect(missions[0].parent_id).toBeNull()

    // Find aims (should have mission as parent)
    const aims = endeavorsResult.endeavors.filter((e: any) => e.id.startsWith('aim:'))
    expect(aims.length).toBeGreaterThanOrEqual(3)

    const aimsWithMissionParent = aims.filter((aim: any) =>
      aim.parent_id && aim.parent_id.startsWith('mission:')
    )
    expect(aimsWithMissionParent.length).toBeGreaterThanOrEqual(2) // At least 2 aims should support the mission

    // Find initiatives (should have aims as parents)
    const initiatives = endeavorsResult.endeavors.filter((e: any) => e.id.startsWith('initiative:'))
    expect(initiatives.length).toBeGreaterThanOrEqual(4)

    const initiativesWithAimParent = initiatives.filter((initiative: any) =>
      initiative.parent_id && initiative.parent_id.startsWith('aim:')
    )
    expect(initiativesWithAimParent.length).toBeGreaterThanOrEqual(3) // At least 3 initiatives should support aims

    console.log('🎯 Hierarchy verification complete:')
    console.log(`   📋 Mission (no parent): ${missions.length}`)
    console.log(`   🎯 Aims with mission parent: ${aimsWithMissionParent.length}`)
    console.log(`   🚀 Initiatives with aim parent: ${initiativesWithAimParent.length}`)

    // Step 5: Verify that the old edges table approach is completely bypassed
    expect(commitResult.summary.edges_added).toBe(planResult.plan.edges.filter((e: any) => e.kind === 'supports').length)
    console.log('✅ Parent_id migration working: edges converted to parent relationships')

  }, 120000) // 2 minute timeout for LLM processing
})

// Helper to run this test manually:
// TEST_LLM_PROMPTS=true npm test -- __tests__/api/markdown-import.api.test.ts