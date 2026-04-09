/**
 * Tests for lib/config/seed-node-types.ts
 *
 * Tests pure logic functions directly (no module mocking needed).
 * The integration point (seedNodeTypes) is tested via its exported helpers.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import {
  loadPresetsFromFile,
  builtinPresetToSeedTypes,
  resolveNodeTypes,
  isDefaultSeed,
  applyNodeTypes
} from '../../lib/config/seed-node-types'

// Mock fs at the module level (loadPresetsFromFile uses it)
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}))

// --- Helpers ---

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function createMockClient(currentSlugs: string[] = ['mission', 'aim', 'initiative', 'task']) {
  const queries: string[] = []
  return {
    query: jest.fn<any>(async (text: string) => {
      queries.push(text)
      if (text.includes('SELECT slug FROM node_types')) {
        return { rows: currentSlugs.map(slug => ({ slug })) }
      }
      return { rows: [] }
    }),
    release: jest.fn(),
    _queries: queries
  }
}

describe('builtinPresetToSeedTypes', () => {
  it('returns node types for a known preset', () => {
    const result = builtinPresetToSeedTypes('agentic-flow')
    expect(result).not.toBeNull()
    expect(result!.length).toBe(4)
    expect(result![0].slug).toBe('mission')
    expect(result![1].slug).toBe('strategic_bet')
    expect(result![2].slug).toBe('capability')
    expect(result![3].slug).toBe('outcome_spec')
  })

  it('returns null for unknown preset', () => {
    expect(builtinPresetToSeedTypes('nonexistent')).toBeNull()
  })

  it('maps chipClasses to chip_classes', () => {
    const result = builtinPresetToSeedTypes('open-horizons')
    expect(result).not.toBeNull()
    for (const nt of result!) {
      expect(nt).toHaveProperty('chip_classes')
      expect(nt).not.toHaveProperty('chipClasses')
    }
  })
})

describe('resolveNodeTypes', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = {
      STRATEGY_PRESET: process.env.STRATEGY_PRESET,
      NEXT_PUBLIC_STRATEGY_PRESET: process.env.NEXT_PUBLIC_STRATEGY_PRESET,
      NODE_TYPES_FILE: process.env.NODE_TYPES_FILE,
    }
    setEnv({ STRATEGY_PRESET: undefined, NEXT_PUBLIC_STRATEGY_PRESET: undefined, NODE_TYPES_FILE: undefined })
  })

  afterEach(() => {
    setEnv(originalEnv)
  })

  it('returns null when no env vars are set', () => {
    expect(resolveNodeTypes()).toBeNull()
  })

  it('returns null when STRATEGY_PRESET is open-horizons', () => {
    setEnv({ STRATEGY_PRESET: 'open-horizons' })
    expect(resolveNodeTypes()).toBeNull()
  })

  it('resolves built-in preset', () => {
    setEnv({ STRATEGY_PRESET: 'agentic-flow' })
    const result = resolveNodeTypes()
    expect(result).not.toBeNull()
    expect(result!.presetId).toBe('agentic-flow')
    expect(result!.nodeTypes.length).toBe(4)
  })

  it('returns null for unknown preset without file', () => {
    setEnv({ STRATEGY_PRESET: 'nonexistent' })
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(resolveNodeTypes()).toBeNull()
    spy.mockRestore()
  })

  it('warns when NODE_TYPES_FILE set without STRATEGY_PRESET', () => {
    setEnv({ NODE_TYPES_FILE: '/some/file.json' })
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveNodeTypes()).toBeNull()
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('NODE_TYPES_FILE is set but STRATEGY_PRESET is not')
    )
    spy.mockRestore()
  })
})

describe('isDefaultSeed', () => {
  it('returns true when slugs match default seed', async () => {
    const client = createMockClient(['mission', 'aim', 'initiative', 'task'])
    expect(await isDefaultSeed(client)).toBe(true)
  })

  it('returns false when extra types exist', async () => {
    const client = createMockClient(['mission', 'aim', 'initiative', 'task', 'custom'])
    expect(await isDefaultSeed(client)).toBe(false)
  })

  it('returns false when order differs', async () => {
    const client = createMockClient(['task', 'initiative', 'aim', 'mission'])
    expect(await isDefaultSeed(client)).toBe(false)
  })

  it('returns false when types are completely different', async () => {
    const client = createMockClient(['strategic_bet', 'capability'])
    expect(await isDefaultSeed(client)).toBe(false)
  })

  it('returns false when table is empty', async () => {
    const client = createMockClient([])
    expect(await isDefaultSeed(client)).toBe(false)
  })
})

describe('applyNodeTypes', () => {
  it('runs BEGIN, DELETE, INSERT, COMMIT in order', async () => {
    const client = createMockClient()
    const nodeTypes = [
      { slug: 'obj', name: 'Objective', sort_order: 0 },
      { slug: 'kr', name: 'Key Result', sort_order: 1 }
    ]

    await applyNodeTypes(client, nodeTypes)

    const q = client._queries
    expect(q[0]).toBe('BEGIN')
    expect(q[1]).toContain('SELECT DISTINCT node_type FROM endeavors')
    expect(q[2]).toContain('DELETE FROM node_types')
    expect(q[3]).toContain('INSERT INTO node_types')
    expect(q[4]).toContain('INSERT INTO node_types')
    expect(q[5]).toBe('COMMIT')
  })

  it('rolls back on failure', async () => {
    let insertCount = 0
    const client = {
      query: jest.fn<any>(async (text: string) => {
        if (text.includes('INSERT INTO node_types')) {
          insertCount++
          if (insertCount === 2) throw new Error('DB write failed')
        }
        return { rows: [] }
      }),
      release: jest.fn(),
      _queries: [] as string[]
    }
    // Track queries manually since mock overrides
    const origQuery = client.query
    client.query = jest.fn<any>(async (text: string, values?: any[]) => {
      client._queries.push(text)
      return origQuery(text, values)
    })

    const nodeTypes = [
      { slug: 'a', name: 'A', sort_order: 0 },
      { slug: 'b', name: 'B', sort_order: 1 },
      { slug: 'c', name: 'C', sort_order: 2 }
    ]

    await expect(applyNodeTypes(client, nodeTypes)).rejects.toThrow('DB write failed')

    expect(client._queries).toContain('ROLLBACK')
    expect(client._queries).not.toContain('COMMIT')
  })

  it('applies defaults for missing optional fields', async () => {
    const client = createMockClient()
    const nodeTypes = [{ slug: 'minimal', name: 'Minimal' }]

    await applyNodeTypes(client, nodeTypes)

    // Check the INSERT was called with default values
    const insertCall = client.query.mock.calls.find(
      (c: any) => (c[0] as string).includes('INSERT INTO node_types')
    )
    expect(insertCall).toBeDefined()
    const values = insertCall![1] as any[]
    expect(values[2]).toBe('')       // description
    expect(values[3]).toBe('📄')     // icon
    expect(values[4]).toBe('#6b7280') // color
    expect(values[7]).toEqual([])    // valid_parents
    expect(values[8]).toBe(0)        // sort_order
  })
})
