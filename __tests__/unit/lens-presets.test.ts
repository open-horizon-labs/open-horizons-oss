/**
 * Unit tests for lens preset CRUD (localStorage-backed).
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  loadPresets,
  savePresets,
  createPreset,
  updatePreset,
  deletePreset,
  LensPreset
} from '../../lib/lens-presets'

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { for (const k in store) delete store[k] },
  get length() { return Object.keys(store).length },
  key: (i: number) => Object.keys(store)[i] ?? null
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => {
  localStorageMock.clear()
})

describe('loadPresets', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadPresets()).toEqual([])
  })

  it('returns empty array for invalid JSON', () => {
    store['lens-presets'] = '{bad json'
    expect(loadPresets()).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    store['lens-presets'] = '{"not": "array"}'
    expect(loadPresets()).toEqual([])
  })

  it('filters out malformed entries', () => {
    store['lens-presets'] = JSON.stringify([
      { id: 'ok', name: 'Good', nodeTypes: ['Mission'] },
      { id: 123, name: 'Bad id' }, // missing nodeTypes, bad id type
      { name: 'No id', nodeTypes: [] }
    ])
    const result = loadPresets()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Good')
  })
})

describe('savePresets', () => {
  it('persists to localStorage', () => {
    const presets: LensPreset[] = [
      { id: 'a', name: 'Alpha', nodeTypes: ['Mission', 'Goal'] }
    ]
    savePresets(presets)
    expect(JSON.parse(store['lens-presets'])).toEqual(presets)
  })
})

describe('createPreset', () => {
  it('creates and persists a new preset', () => {
    const preset = createPreset('Strategic', ['Mission', 'Goal'])
    expect(preset.name).toBe('Strategic')
    expect(preset.nodeTypes).toEqual(['Mission', 'Goal'])
    expect(preset.id).toMatch(/^strategic_/)

    const loaded = loadPresets()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(preset.id)
  })

  it('appends to existing presets', () => {
    createPreset('Alpha', ['Mission'])
    createPreset('Beta', ['Goal'])
    expect(loadPresets()).toHaveLength(2)
  })
})

describe('updatePreset', () => {
  it('updates name and nodeTypes', () => {
    const preset = createPreset('Old', ['Mission'])
    const result = updatePreset(preset.id, { name: 'New', nodeTypes: ['Goal', 'Task'] })
    expect(result).toBe(true)

    const loaded = loadPresets()
    expect(loaded[0].name).toBe('New')
    expect(loaded[0].nodeTypes).toEqual(['Goal', 'Task'])
  })

  it('returns false for unknown id', () => {
    expect(updatePreset('nonexistent', { name: 'X' })).toBe(false)
  })

  it('can update only name', () => {
    const preset = createPreset('Original', ['Mission'])
    updatePreset(preset.id, { name: 'Renamed' })
    const loaded = loadPresets()
    expect(loaded[0].name).toBe('Renamed')
    expect(loaded[0].nodeTypes).toEqual(['Mission'])
  })
})

describe('deletePreset', () => {
  it('removes the preset', () => {
    const p1 = createPreset('A', ['Mission'])
    const p2 = createPreset('B', ['Goal'])
    const result = deletePreset(p1.id)
    expect(result).toBe(true)

    const loaded = loadPresets()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(p2.id)
  })

  it('returns false for unknown id', () => {
    expect(deletePreset('nonexistent')).toBe(false)
  })
})
