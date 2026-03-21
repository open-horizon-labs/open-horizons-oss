/**
 * Security tests for API authentication and user isolation
 * These tests verify that users cannot access other users' data
 */

import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('API Security Tests', () => {
  const harness = new ApiTestHarness({ port: 3003 })

  beforeAll(async () => {
    validateEnvironment()

    console.log('🔧 Security test environment validated')

    // Start the app and wait for it to be ready
    // The harness will automatically ensure test users exist
    await harness.startApp()
    await harness.waitForReady()
  }, 180000) // 3 minute timeout for app startup + user setup

  afterAll(async () => {
    await harness.stopApp()
  }, 30000)

  describe('User Data Isolation', () => {
    it('should prevent user 1 from accessing user 2 profile', async () => {
      // First, user 2 creates a profile
      const user2Profile = {
        about_me: 'I am user 2 - this should be private',
        llm_personalization: 'User 2 preferences'
      }

      const createResponse = await harness.makeRequestWithKey('/api/profile', {
        method: 'POST',
        body: JSON.stringify(user2Profile)
      }, process.env.TEST_API_KEY_2!)

      expect(createResponse.status).toBe(200)

      // Now user 1 tries to access their own profile
      // This should NOT return user 2's data
      const user1Response = await harness.makeRequestWithKey('/api/profile', {}, process.env.TEST_API_KEY_1!)

      expect(user1Response.status).toBe(200)
      const user1Data = await user1Response.json()

      // User 1 should NOT see user 2's data
      expect(user1Data.about_me).not.toBe(user2Profile.about_me)
      expect(user1Data.llm_personalization).not.toBe(user2Profile.llm_personalization)
    })

    it('should prevent user 2 from accessing user 1 profile', async () => {
      // First, user 1 creates a profile
      const user1Profile = {
        about_me: 'I am user 1 - this should be private',
        llm_personalization: 'User 1 preferences'
      }

      const createResponse = await harness.makeRequestWithKey('/api/profile', {
        method: 'POST',
        body: JSON.stringify(user1Profile)
      }, process.env.TEST_API_KEY_1!)

      expect(createResponse.status).toBe(200)

      // Now user 2 tries to access their own profile
      // This should NOT return user 1's data
      const user2Response = await harness.makeRequestWithKey('/api/profile', {}, process.env.TEST_API_KEY_2!)

      expect(user2Response.status).toBe(200)
      const user2Data = await user2Response.json()

      // User 2 should NOT see user 1's data
      expect(user2Data.about_me).not.toBe(user1Profile.about_me)
      expect(user2Data.llm_personalization).not.toBe(user1Profile.llm_personalization)
    })

    it('should allow users to update only their own profiles', async () => {
      // User 1 creates a profile
      const user1Profile = {
        about_me: 'User 1 original profile',
        llm_personalization: 'User 1 original preferences'
      }

      await harness.makeRequestWithKey('/api/profile', {
        method: 'POST',
        body: JSON.stringify(user1Profile)
      }, process.env.TEST_API_KEY_1!)

      // User 2 creates a different profile
      const user2Profile = {
        about_me: 'User 2 original profile',
        llm_personalization: 'User 2 original preferences'
      }

      await harness.makeRequestWithKey('/api/profile', {
        method: 'POST',
        body: JSON.stringify(user2Profile)
      }, process.env.TEST_API_KEY_2!)

      // User 1 updates their profile
      const user1Update = {
        about_me: 'User 1 UPDATED profile',
        llm_personalization: 'User 1 UPDATED preferences'
      }

      const updateResponse = await harness.makeRequestWithKey('/api/profile', {
        method: 'POST',
        body: JSON.stringify(user1Update)
      }, process.env.TEST_API_KEY_1!)

      expect(updateResponse.status).toBe(200)

      // Verify user 1 sees their update
      const user1Check = await harness.makeRequestWithKey('/api/profile', {}, process.env.TEST_API_KEY_1!)
      const user1Data = await user1Check.json()
      expect(user1Data.about_me).toBe(user1Update.about_me)

      // Verify user 2's profile is unchanged
      const user2Check = await harness.makeRequestWithKey('/api/profile', {}, process.env.TEST_API_KEY_2!)
      const user2Data = await user2Check.json()
      expect(user2Data.about_me).toBe(user2Profile.about_me)
      expect(user2Data.llm_personalization).toBe(user2Profile.llm_personalization)
    })
  })

  describe('Authentication Validation', () => {
    it('should reject requests with completely invalid API key', async () => {
      const response = await harness.makeRequestWithKey('/api/profile', {}, 'ak_totally_invalid_key_12345')

      expect(response.status).toBe(401)
    })

    it('should reject requests with valid format but wrong key', async () => {
      // Generate a properly formatted but non-existent key
      const fakeKey = 'ak_' + '0'.repeat(64)

      const response = await harness.makeRequestWithKey('/api/profile', {}, fakeKey)

      expect(response.status).toBe(401)
    })

    it('should reject requests with empty authorization header', async () => {
      const response = await harness.makePublicRequest('/api/profile', {
        headers: {
          'Authorization': ''
        }
      })

      expect(response.status).toBe(401)
    })
  })
})