'use client'

import { useState, useEffect, useCallback } from 'react'

interface NodeType {
  slug: string
  name: string
  description: string
  icon: string
  color: string
  chip_classes: string
  valid_children: string[]
  valid_parents: string[]
  sort_order: number
}

const EMPTY_NODE_TYPE: Omit<NodeType, 'sort_order'> = {
  slug: '',
  name: '',
  description: '',
  icon: '📄',
  color: '#6b7280',
  chip_classes: 'bg-gray-100 text-gray-800 border-gray-200',
  valid_children: [],
  valid_parents: []
}

export default function NodeTypesSettingsPage() {
  const [nodeTypes, setNodeTypes] = useState<NodeType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<NodeType>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_NODE_TYPE)
  const [error, setError] = useState<string | null>(null)

  const loadNodeTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/node-types')
      const data = await res.json()
      setNodeTypes(data.nodeTypes || [])
    } catch {
      setError('Failed to load node types')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadNodeTypes() }, [loadNodeTypes])

  const saveNodeType = async (nt: Partial<NodeType>) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/node-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nt)
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      await loadNodeTypes()
      setEditingSlug(null)
      setShowAddForm(false)
      setAddForm(EMPTY_NODE_TYPE)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const deleteNodeType = async (slug: string) => {
    if (!confirm(`Delete node type "${slug}"? This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/node-types', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      await loadNodeTypes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  const allSlugs = nodeTypes.map(nt => nt.slug)

  if (loading) return <div>Loading node types...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Node Types</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure the strategy hierarchy. Node types define what kinds of endeavors can exist and how they relate to each other.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">dismiss</button>
        </div>
      )}

      {/* Hierarchy preview */}
      <div className="bg-gray-50 rounded-lg p-4 border">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Current Hierarchy</h3>
        <div className="font-mono text-sm">
          {nodeTypes.map((nt, i) => (
            <div key={nt.slug} style={{ paddingLeft: `${i * 24}px` }}>
              {i > 0 && <span className="text-gray-400">{'└── '}</span>}
              <span>{nt.icon}</span>{' '}
              <span className="font-semibold">{nt.name}</span>{' '}
              <span className="text-gray-500">({nt.slug})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Node type list */}
      <div className="space-y-3">
        {nodeTypes.map((nt) => (
          <div key={nt.slug} className="border rounded-lg p-4">
            {editingSlug === nt.slug ? (
              <NodeTypeForm
                value={editForm}
                allSlugs={allSlugs}
                currentSlug={nt.slug}
                onChange={setEditForm}
                onSave={() => saveNodeType({ ...editForm, slug: nt.slug })}
                onCancel={() => setEditingSlug(null)}
                saving={saving}
                isNew={false}
              />
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{nt.icon}</span>
                  <div>
                    <div className="font-semibold">{nt.name} <span className="text-sm text-gray-500 font-normal">({nt.slug})</span></div>
                    <div className="text-sm text-gray-600">{nt.description}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Children: {nt.valid_children.length > 0 ? nt.valid_children.join(', ') : 'none'}
                      {' | '}
                      Parents: {nt.valid_parents.length > 0 ? nt.valid_parents.join(', ') : 'none (root)'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: nt.color }} />
                  <button
                    onClick={() => { setEditingSlug(nt.slug); setEditForm(nt) }}
                    className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteNodeType(nt.slug)}
                    className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded"
                    disabled={saving}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      {showAddForm ? (
        <div className="border rounded-lg p-4 border-green-300 bg-green-50">
          <h3 className="font-medium mb-3">Add Node Type</h3>
          <NodeTypeForm
            value={addForm}
            allSlugs={allSlugs}
            onChange={(v) => setAddForm(prev => ({ ...prev, ...v }))}
            onSave={() => saveNodeType({ ...addForm, sort_order: nodeTypes.length })}
            onCancel={() => { setShowAddForm(false); setAddForm(EMPTY_NODE_TYPE) }}
            saving={saving}
            isNew={true}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
        >
          + Add Node Type
        </button>
      )}

      {/* Preset loader */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Load Preset</h3>
        <p className="text-xs text-gray-500 mb-2">Replace all node types with a built-in preset.</p>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!confirm('Replace all node types with Open Horizons preset? (Mission > Aim > Initiative > Task)')) return
              const presets = [
                { slug: 'mission', name: 'Mission', description: 'High-level purpose and direction', icon: '🎯', color: '#7c3aed', chip_classes: 'bg-purple-100 text-purple-800 border-purple-200', valid_children: ['aim'], valid_parents: [], sort_order: 0 },
                { slug: 'aim', name: 'Aim', description: 'Strategic objectives and measurable outcomes', icon: '🏹', color: '#2563eb', chip_classes: 'bg-blue-100 text-blue-800 border-blue-200', valid_children: ['initiative'], valid_parents: ['mission'], sort_order: 1 },
                { slug: 'initiative', name: 'Initiative', description: 'Active projects and work streams', icon: '🚀', color: '#16a34a', chip_classes: 'bg-green-100 text-green-800 border-green-200', valid_children: ['task'], valid_parents: ['aim'], sort_order: 2 },
                { slug: 'task', name: 'Task', description: 'Specific actionable items', icon: '✓', color: '#6b7280', chip_classes: 'bg-gray-100 text-gray-800 border-gray-200', valid_children: [], valid_parents: ['initiative'], sort_order: 3 },
              ]
              for (const p of presets) await fetch('/api/node-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
              loadNodeTypes()
            }}
            className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Open Horizons
          </button>
          <button
            onClick={async () => {
              if (!confirm('Replace all node types with Agentic Flow preset? (Mission > Strategic Bet > Capability > Tactical Plan > Outcome)')) return
              const presets = [
                { slug: 'mission', name: 'Mission', description: 'High-level purpose and direction', icon: '🎯', color: '#7c3aed', chip_classes: 'bg-purple-100 text-purple-800 border-purple-200', valid_children: ['strategic_bet'], valid_parents: [], sort_order: 0 },
                { slug: 'strategic_bet', name: 'Strategic Bet', description: 'High-conviction investment areas', icon: '🎲', color: '#dc2626', chip_classes: 'bg-red-100 text-red-800 border-red-200', valid_children: ['capability'], valid_parents: ['mission'], sort_order: 1 },
                { slug: 'capability', name: 'Capability', description: 'Skills, systems, or assets', icon: '⚙️', color: '#2563eb', chip_classes: 'bg-blue-100 text-blue-800 border-blue-200', valid_children: ['tactical_plan'], valid_parents: ['strategic_bet'], sort_order: 2 },
                { slug: 'tactical_plan', name: 'Tactical Plan', description: 'Concrete plans to build capabilities', icon: '📋', color: '#16a34a', chip_classes: 'bg-green-100 text-green-800 border-green-200', valid_children: ['outcome'], valid_parents: ['capability'], sort_order: 3 },
                { slug: 'outcome', name: 'Outcome', description: 'Measurable results', icon: '⭐', color: '#ca8a04', chip_classes: 'bg-yellow-100 text-yellow-800 border-yellow-200', valid_children: [], valid_parents: ['tactical_plan'], sort_order: 4 },
              ]
              for (const p of presets) await fetch('/api/node-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
              loadNodeTypes()
            }}
            className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Agentic Flow
          </button>
        </div>
      </div>
    </div>
  )
}

function NodeTypeForm({
  value,
  allSlugs,
  currentSlug,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew
}: {
  value: Partial<NodeType>
  allSlugs: string[]
  currentSlug?: string
  onChange: (v: Partial<NodeType>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew: boolean
}) {
  const otherSlugs = allSlugs.filter(s => s !== currentSlug)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {isNew && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Slug (URL-safe ID)</label>
            <input
              type="text"
              value={value.slug || ''}
              onChange={e => onChange({ ...value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              className="w-full p-2 border rounded text-sm"
              placeholder="e.g. strategic_bet"
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
          <input
            type="text"
            value={value.name || ''}
            onChange={e => onChange({ ...value, name: e.target.value })}
            className="w-full p-2 border rounded text-sm"
            placeholder="e.g. Strategic Bet"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Icon (emoji)</label>
          <input
            type="text"
            value={value.icon || ''}
            onChange={e => onChange({ ...value, icon: e.target.value })}
            className="w-full p-2 border rounded text-sm"
            placeholder="e.g. 🎯"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={value.description || ''}
          onChange={e => onChange({ ...value, description: e.target.value })}
          className="w-full p-2 border rounded text-sm"
          placeholder="What this type represents"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Color (hex)</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={value.color || '#6b7280'}
              onChange={e => onChange({ ...value, color: e.target.value })}
              className="h-8 w-8 rounded border cursor-pointer"
            />
            <input
              type="text"
              value={value.color || ''}
              onChange={e => onChange({ ...value, color: e.target.value })}
              className="flex-1 p-2 border rounded text-sm font-mono"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Valid Children (slugs, comma-separated)</label>
          <input
            type="text"
            value={(value.valid_children || []).join(', ')}
            onChange={e => onChange({ ...value, valid_children: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full p-2 border rounded text-sm"
            placeholder={`e.g. ${otherSlugs.join(', ')}`}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !value.name || (isNew && !value.slug)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
