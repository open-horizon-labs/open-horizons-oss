/**
 * Integration test for personal context creation during login
 * Ensures that users get a personal context automatically when they sign up/login
 */

import { ApiTestHarness } from './api-harness'
import { createClient } from '@supabase/supabase-js'

// Skip tests if SUPABASE_SECRET_KEY is not set for security
if (!process.env.SUPABASE_SECRET_KEY) {
  console.warn('⚠️  Skipping Personal Context tests: SUPABASE_SECRET_KEY not set')
  describe.skip('Personal Context Creation', () => {
    test('skipped', () => {})
  })
} else {

describe('Personal Context Creation', () => {
  const harness = new ApiTestHarness()

  // Create service role client for testing - env var is required
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  describe('User Setup on Authentication', () => {
    test('should create personal context when new user signs up', async () => {
      // Create a new user directly through Supabase Admin API
      const testEmail = `test-${Date.now()}@example.com`
      const testPassword = 'testpassword123'

      // Create user via admin API
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true
      })

      expect(createError).toBeNull()
      expect(userData?.user).toBeDefined()

      const userId = userData!.user!.id

      // Simulate the user setup that should happen during auth callback
      const { ensureUserNodeWithData } = await import('../../lib/user/setup')
      const result = await ensureUserNodeWithData(userData!.user!, supabase)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()

      // Verify personal context was created
      const personalContextId = `personal:${userId}`

      const { data: context, error: contextError } = await supabase
        .from('contexts')
        .select('*')
        .eq('id', personalContextId)
        .single()

      expect(contextError).toBeNull()
      expect(context).toBeDefined()
      expect(context?.id).toBe(personalContextId)
      expect(context?.created_by).toBe(userId)
      expect(context?.title).toBe('Personal Context')

      // Verify context membership was created
      const { data: membership, error: membershipError } = await supabase
        .from('context_memberships')
        .select('*')
        .eq('context_id', personalContextId)
        .eq('user_id', userId)
        .single()

      expect(membershipError).toBeNull()
      expect(membership).toBeDefined()

      // Verify user node was created
      const userNodeId = `user:${userId}`

      const { data: userNode, error: nodeError } = await supabase
        .from('endeavors')
        .select('*')
        .eq('id', userNodeId)
        .single()

      expect(nodeError).toBeNull()
      expect(userNode).toBeDefined()
      expect(userNode?.id).toBe(userNodeId)
      expect(userNode?.user_id).toBe(userId)
      expect(userNode?.status).toBe('active')
      expect(userNode?.metadata?.node_type).toBe('user')
      expect(userNode?.metadata?.is_system_node).toBe(true)

      // Cleanup: delete the test user
      await supabase.auth.admin.deleteUser(userId)
    }, 30000)

    test('should handle existing user login without duplicating personal context', async () => {
      // Create a user with existing personal context
      const testEmail = `existing-${Date.now()}@example.com`
      const testPassword = 'testpassword123'

      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true
      })

      expect(createError).toBeNull()
      const userId = userData!.user!.id

      // First setup - should create everything
      const { ensureUserNodeWithData } = await import('../../lib/user/setup')
      const firstResult = await ensureUserNodeWithData(userData!.user!, supabase)
      expect(firstResult.success).toBe(true)

      // Second setup - should handle existing data gracefully
      const secondResult = await ensureUserNodeWithData(userData!.user!, supabase)
      expect(secondResult.success).toBe(true)
      expect(secondResult.error).toBeUndefined()

      // Verify only one context exists
      const personalContextId = `personal:${userId}`

      const { data: contexts, error: contextError } = await supabase
        .from('contexts')
        .select('*')
        .eq('id', personalContextId)

      expect(contextError).toBeNull()
      expect(contexts?.length).toBe(1)

      // Verify only one membership exists
      const { data: memberships, error: membershipError } = await supabase
        .from('context_memberships')
        .select('*')
        .eq('context_id', personalContextId)
        .eq('user_id', userId)

      expect(membershipError).toBeNull()
      expect(memberships?.length).toBe(1)

      // Cleanup
      await supabase.auth.admin.deleteUser(userId)
    }, 30000)
  })
})

} // End of else block for SUPABASE_SECRET_KEY check
