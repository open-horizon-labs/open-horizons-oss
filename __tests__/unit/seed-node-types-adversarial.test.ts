import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Test that seedNodeTypes handles edge cases

describe('adversarial: seed-node-types', () => {
  beforeEach(() => { jest.resetModules() })

  it('resolveNodeTypes handles empty string STRATEGY_PRESET', async () => {
    process.env.STRATEGY_PRESET = ''
    const { resolveNodeTypes } = await import('../../lib/config/seed-node-types')
    // Empty string is falsy, should behave like unset
    expect(resolveNodeTypes()).toBeNull()
    delete process.env.STRATEGY_PRESET
  })

  it('resolveNodeTypes handles whitespace-only STRATEGY_PRESET', async () => {
    process.env.STRATEGY_PRESET = '  '
    const { resolveNodeTypes } = await import('../../lib/config/seed-node-types')
    // Whitespace is truthy — should fail with unknown preset error
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(resolveNodeTypes()).toBeNull()
    spy.mockRestore()
    delete process.env.STRATEGY_PRESET
  })

  it('isDefaultSeed handles DB error gracefully', async () => {
    const { isDefaultSeed } = await import('../../lib/config/seed-node-types')
    const badClient = {
      query: jest.fn<any>().mockRejectedValue(new Error('connection refused'))
    }
    await expect(isDefaultSeed(badClient)).rejects.toThrow('connection refused')
  })

  it('applyNodeTypes with empty array deletes all non-protected types', async () => {
    const { applyNodeTypes } = await import('../../lib/config/seed-node-types')
    const queries: string[] = []
    const client = {
      query: jest.fn<any>(async (text: string) => {
        queries.push(text)
        return { rows: [] }
      })
    }
    await applyNodeTypes(client, [])
    expect(queries).toContain('BEGIN')
    expect(queries).toContain('COMMIT')
    // DELETE should run even with empty array
    expect(queries.some(q => q.includes('DELETE FROM node_types'))).toBe(true)
  })

  it('applyNodeTypes aborts when deletion would orphan endeavors', async () => {
    const { applyNodeTypes } = await import('../../lib/config/seed-node-types')
    const queries: string[] = []
    const client = {
      query: jest.fn<any>(async (text: string) => {
        queries.push(text)
        if (text.includes('SELECT DISTINCT node_type FROM endeavors')) {
          // Simulate endeavors using a type that the new preset doesn't include
          return { rows: [{ node_type: 'old_type' }] }
        }
        return { rows: [] }
      })
    }
    await expect(
      applyNodeTypes(client, [{ slug: 'new_type', name: 'New' }])
    ).rejects.toThrow('Cannot remove node types still used by endeavors: old_type')
    expect(queries).toContain('ROLLBACK')
    expect(queries).not.toContain('DELETE FROM node_types')
  })
})
