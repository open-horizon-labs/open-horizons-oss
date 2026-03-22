/**
 * Lens Presets -- user-configurable named sets of node types.
 *
 * Stored in localStorage so they persist across sessions.
 * Each preset maps a user-chosen label to an array of node type names
 * (e.g., "Strategic" -> ["Mission", "Goal"]).
 */

export interface LensPreset {
  /** Unique id (nanoid-style, or slug derived from name) */
  id: string
  /** User-visible label shown in the preset bar */
  name: string
  /** Node type names included in this preset */
  nodeTypes: string[]
}

const STORAGE_KEY = 'lens-presets'

/** Read all saved presets from localStorage. Returns [] on parse error. */
export function loadPresets(): LensPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Basic shape validation
    return parsed.filter(
      (p: any) =>
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        Array.isArray(p.nodeTypes)
    )
  } catch {
    return []
  }
}

/** Persist the full preset list. */
export function savePresets(presets: LensPreset[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

/** Generate a simple id from the name (lowercase, underscored, timestamped). */
function generateId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return `${slug}_${Date.now()}`
}

/** Create a new preset and persist it. Returns the created preset. */
export function createPreset(name: string, nodeTypes: string[]): LensPreset {
  const presets = loadPresets()
  const preset: LensPreset = { id: generateId(name), name, nodeTypes }
  presets.push(preset)
  savePresets(presets)
  return preset
}

/** Update an existing preset by id. Returns true if found and updated. */
export function updatePreset(id: string, updates: Partial<Pick<LensPreset, 'name' | 'nodeTypes'>>): boolean {
  const presets = loadPresets()
  const idx = presets.findIndex(p => p.id === id)
  if (idx === -1) return false
  if (updates.name !== undefined) presets[idx].name = updates.name
  if (updates.nodeTypes !== undefined) presets[idx].nodeTypes = updates.nodeTypes
  savePresets(presets)
  return true
}

/** Delete a preset by id. Returns true if found and deleted. */
export function deletePreset(id: string): boolean {
  const presets = loadPresets()
  const filtered = presets.filter(p => p.id !== id)
  if (filtered.length === presets.length) return false
  savePresets(filtered)
  return true
}
