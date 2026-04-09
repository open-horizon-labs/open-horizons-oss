/**
 * Startup Node Type Seeding
 *
 * Seeds the node_types table on app startup based on environment configuration.
 *
 * Resolution order:
 *   1. If NODE_TYPES_FILE is set, load the JSON file as a preset registry.
 *      STRATEGY_PRESET selects which key to use from the file.
 *   2. If STRATEGY_PRESET is set but no file, use the built-in preset.
 *   3. If neither is set, do nothing (default seed.sql already ran).
 *
 * Idempotency: only applies if the current node_types match the default seed
 * (mission, aim, initiative, task in that order). If the user has customized
 * types via Settings, this does nothing.
 */

import { getClient } from '../db'
import { invalidateNodeTypeCache, PRESETS } from './index'
import { readFileSync, existsSync } from 'fs'

const DEFAULT_SEED_SLUGS = ['mission', 'aim', 'initiative', 'task']

interface SeedNodeType {
  slug: string
  name: string
  description?: string
  icon?: string
  color?: string
  chip_classes?: string
  valid_children?: string[]
  valid_parents?: string[]
  sort_order?: number
}

/**
 * Load a preset registry from a JSON file.
 * The file is a JSON object keyed by preset name, each value an array of node types.
 * Same shape as POST /api/node-types/load-preset.
 */
export function loadPresetsFromFile(filePath: string): Record<string, SeedNodeType[]> {
  if (!existsSync(filePath)) {
    console.warn(`[seed-node-types] NODE_TYPES_FILE not found: ${filePath}`)
    return {}
  }

  try {
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.error('[seed-node-types] NODE_TYPES_FILE must be a JSON object keyed by preset name')
      return {}
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) {
        console.error(`[seed-node-types] Preset "${key}" must be an array of node types`)
        return {}
      }
      for (const nt of value as any[]) {
        if (!nt.slug || !nt.name) {
          console.error(`[seed-node-types] Preset "${key}" has a node type missing slug or name`)
          return {}
        }
      }
    }

    return parsed as Record<string, SeedNodeType[]>
  } catch (err) {
    console.error(`[seed-node-types] Failed to parse NODE_TYPES_FILE: ${err}`)
    return {}
  }
}

/**
 * Convert a built-in StrategyConfig preset to the seed format.
 */
export function builtinPresetToSeedTypes(presetId: string): SeedNodeType[] | null {
  const preset = PRESETS[presetId]
  if (!preset) return null

  return preset.nodeTypes.map((nt, i) => ({
    slug: nt.slug,
    name: nt.name,
    description: nt.description || '',
    icon: nt.icon || '📄',
    color: nt.color || '#6b7280',
    chip_classes: nt.chipClasses || 'bg-gray-100 text-gray-800 border-gray-200',
    valid_children: nt.validChildren || [],
    valid_parents: nt.validParents || [],
    sort_order: i
  }))
}

/**
 * Resolve which node types to seed based on env vars.
 * Returns null if no seeding should occur.
 */
export function resolveNodeTypes(): { presetId: string; nodeTypes: SeedNodeType[] } | null {
  const presetId = process.env.STRATEGY_PRESET || process.env.NEXT_PUBLIC_STRATEGY_PRESET
  const nodeTypesFile = process.env.NODE_TYPES_FILE

  // No preset override configured — use defaults
  if (!presetId || presetId === 'open-horizons') {
    if (!nodeTypesFile) return null

    // File is set but no preset selected — that's a config error
    console.warn('[seed-node-types] NODE_TYPES_FILE is set but STRATEGY_PRESET is not. Set STRATEGY_PRESET to select a preset from the file.')
    return null
  }

  // Try the file first
  if (nodeTypesFile) {
    const filePresets = loadPresetsFromFile(nodeTypesFile)
    const nodeTypes = filePresets[presetId]
    if (nodeTypes) {
      return { presetId, nodeTypes }
    }
    console.warn(`[seed-node-types] Preset "${presetId}" not found in ${nodeTypesFile}, falling back to built-in presets`)
  }

  // Fall back to built-in presets
  const nodeTypes = builtinPresetToSeedTypes(presetId)
  if (nodeTypes) {
    return { presetId, nodeTypes }
  }

  const available = [
    ...Object.keys(PRESETS),
    ...(nodeTypesFile ? ['(check NODE_TYPES_FILE for custom presets)'] : [])
  ]
  console.error(`[seed-node-types] Unknown preset "${presetId}". Available: ${available.join(', ')}`)
  return null
}

/**
 * Check if the current node_types table matches the default seed.
 * Returns true if safe to overwrite with a preset.
 */
export async function isDefaultSeed(client: any): Promise<boolean> {
  const result = await client.query(
    'SELECT slug FROM node_types ORDER BY sort_order ASC'
  )
  const currentSlugs = result.rows.map((r: any) => r.slug)

  if (currentSlugs.length !== DEFAULT_SEED_SLUGS.length) return false
  return currentSlugs.every((slug: string, i: number) => slug === DEFAULT_SEED_SLUGS[i])
}

/**
 * Apply node types to the database using the same upsert logic as load-preset.
 */
export async function applyNodeTypes(client: any, nodeTypes: SeedNodeType[]): Promise<void> {
  await client.query('BEGIN')

  try {
    // Delete types not in the new preset and not used by endeavors
    await client.query(
      'DELETE FROM node_types WHERE slug NOT IN (SELECT unnest($1::text[]))',
      [nodeTypes.map(nt => nt.slug)]
    )

    // Upsert all new types
    for (const nt of nodeTypes) {
      await client.query(
        `INSERT INTO node_types (slug, name, description, icon, color, chip_classes, valid_children, valid_parents, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           icon = EXCLUDED.icon,
           color = EXCLUDED.color,
           chip_classes = EXCLUDED.chip_classes,
           valid_children = EXCLUDED.valid_children,
           valid_parents = EXCLUDED.valid_parents,
           sort_order = EXCLUDED.sort_order`,
        [
          nt.slug, nt.name, nt.description || '',
          nt.icon || '📄', nt.color || '#6b7280',
          nt.chip_classes || 'bg-gray-100 text-gray-800 border-gray-200',
          nt.valid_children || [], nt.valid_parents || [],
          nt.sort_order ?? 0
        ]
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

/**
 * Main entry point. Call from instrumentation.ts register() hook.
 */
export async function seedNodeTypes(): Promise<void> {
  const resolved = resolveNodeTypes()
  if (!resolved) return

  const { presetId, nodeTypes } = resolved
  const client = await getClient()

  try {
    const isDefault = await isDefaultSeed(client)
    if (!isDefault) {
      console.log(`[seed-node-types] Node types have been customized — skipping preset "${presetId}" seed`)
      return
    }

    await applyNodeTypes(client, nodeTypes)
    invalidateNodeTypeCache()
    console.log(`[seed-node-types] Seeded ${nodeTypes.length} node types from preset "${presetId}"`)
  } catch (err) {
    console.error(`[seed-node-types] Failed to seed node types:`, err)
  } finally {
    client.release()
  }
}
