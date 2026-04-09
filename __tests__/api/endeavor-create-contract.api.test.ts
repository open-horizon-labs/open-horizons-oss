import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('Endeavor Create Contract API Tests', () => {
  const harness = new ApiTestHarness({ port: 3003 })

  beforeAll(async () => {
    validateEnvironment()
    await harness.startApp()
    await harness.waitForReady()
  }, 180000)

  afterAll(async () => {
    await harness.stopApp()
  }, 30000)

  it('persists description and parent when canonical create fields are used', async () => {
    const parentResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Contract Parent Mission',
        type: 'mission',
      }),
    }, process.env.TEST_API_KEY_1!)

    expect(parentResponse.status).toBe(200)
    const parentResult = await parentResponse.json()
    const parentId = parentResult.endeavorId

    const childResponse = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Contract Child Aim',
        type: 'aim',
        description: 'Persist this description on create',
        parentId,
      }),
    }, process.env.TEST_API_KEY_1!)

    expect(childResponse.status).toBe(200)
    const childResult = await childResponse.json()
    expect(childResult.success).toBe(true)
    expect(typeof childResult.endeavorId).toBe('string')

    const getResponse = await harness.makeRequestWithKey(`/api/endeavors/${encodeURIComponent(childResult.endeavorId)}`, {
      method: 'GET',
    }, process.env.TEST_API_KEY_1!)

    expect(getResponse.status).toBe(200)
    const getResult = await getResponse.json()
    expect(getResult.endeavor.description).toBe('Persist this description on create')
    expect(getResult.endeavor.parent_id).toBe(parentId)
  })

  it('rejects unknown create fields instead of silently ignoring them', async () => {
    const response = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Legacy Payload',
        type: 'mission',
        parent_id: 'legacy-parent-id',
      }),
    }, process.env.TEST_API_KEY_1!)

    expect(response.status).toBe(400)
    const result = await response.json()

    expect(result.error).toContain('Contract violation')
    expect(Array.isArray(result.issues)).toBe(true)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'parent_id' }),
      ])
    )
  })

  it('points invalid type callers to the about endpoint', async () => {
    const response = await harness.makeRequestWithKey('/api/endeavors/create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Unknown Type Payload',
        type: 'not_a_real_type',
      }),
    }, process.env.TEST_API_KEY_1!)

    expect(response.status).toBe(400)
    const result = await response.json()

    expect(result.error).toContain('Contract violation')
    expect(result.details).toContain('GET /api/about')
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'type' }),
      ])
    )
  })
})
