import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '../../.env.local') })

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { ApiTestHarness } from './api-harness'
import { validateEnvironment } from './test-setup'

describe('About API Tests', () => {
  const harness = new ApiTestHarness({ port: 3003 })

  beforeAll(async () => {
    validateEnvironment()
    await harness.startApp()
    await harness.waitForReady()
  }, 180000)

  afterAll(async () => {
    await harness.stopApp()
  }, 30000)

  it('exposes the live create contract and valid type slugs', async () => {
    const response = await harness.makeRequest('/api/about', {
      method: 'GET',
    })

    expect(response.status).toBe(200)
    const result = await response.json()

    expect(result.apiEndpoints.endeavors.create.method).toBe('POST')
    expect(result.apiEndpoints.endeavors.create.path).toBe('/api/endeavors/create')
    expect(result.apiEndpoints.endeavors.create.request.requiredFields).toEqual(['title', 'type'])
    expect(result.apiEndpoints.endeavors.create.request.optionalFields).toEqual(['description', 'contextId', 'parentId'])
    expect(result.apiEndpoints.endeavors.create.request.unknownFieldsRejected).toBe(true)
    expect(result.apiEndpoints.endeavors.create.discoverability).toBe('GET /api/about')

    const hierarchySlugs = result.coreModel.hierarchy.map((nodeType: { slug: string }) => nodeType.slug)
    expect(result.apiEndpoints.endeavors.create.request.validTypeSlugs).toEqual(hierarchySlugs)
    expect(hierarchySlugs.length).toBeGreaterThan(0)
  })
})
