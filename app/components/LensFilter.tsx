'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { SingleRoleChip } from './NodeTypeChips'
import { getActiveConfig } from '../../lib/config'
import {
  LensPreset,
  loadPresets,
  createPreset,
  updatePreset,
  deletePreset
} from '../../lib/lens-presets'

interface LensFilterProps {
  selectedRoles: string[]
  onRoleToggle: (role: string) => void
  onClear: () => void
  availableRoles?: string[]
  compact?: boolean
}

function getDefaultAvailableRoles(): string[] {
  return getActiveConfig().nodeTypes.map(nt => nt.name)
}

function getLensDescriptions(): Record<string, string> {
  const descriptions: Record<string, string> = {}
  for (const nt of getActiveConfig().nodeTypes) {
    descriptions[nt.name.toLowerCase()] = nt.description
  }
  return descriptions
}

export function LensFilter({
  selectedRoles,
  onRoleToggle,
  onClear,
  availableRoles = getDefaultAvailableRoles(),
  compact = false
}: LensFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const lensDescriptions = getLensDescriptions()

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard events
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const hasActiveFilter = selectedRoles.length > 0

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
          transition-colors
          ${hasActiveFilter
            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }
        `}
      >
        {/* Lens Icon */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
        </svg>

        {hasActiveFilter ? (
          <span>Lens: {selectedRoles.length} role{selectedRoles.length === 1 ? '' : 's'}</span>
        ) : (
          <span>Apply Lens</span>
        )}

        {/* Chevron */}
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Active Filter Display */}
      {hasActiveFilter && !isOpen && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedRoles.map(role => (
            <SingleRoleChip
              key={role}
              role={role}
              compact={compact}
              onClick={() => onRoleToggle(role)}
            />
          ))}
          <button
            onClick={onClear}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Clear all filters"
          >
            Clear
          </button>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="mb-3">
              <h3 className="font-medium text-gray-900 mb-1">Apply Role Lens</h3>
              <p className="text-sm text-gray-600">
                Filter to show only endeavors with selected roles
              </p>
            </div>

            {/* Role Grid */}
            <div className="space-y-2 mb-4">
              {availableRoles.map(role => {
                const isSelected = selectedRoles.includes(role)
                return (
                  <button
                    key={role}
                    onClick={() => onRoleToggle(role)}
                    className={`
                      w-full flex items-center justify-between p-2 rounded border text-sm
                      transition-colors text-left
                      ${isSelected
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <SingleRoleChip role={role} compact />
                      <div>
                        <div className="font-medium capitalize">{role}</div>
                        <div className="text-xs text-gray-500">
                          {lensDescriptions[role.toLowerCase()] || ''}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <button
                onClick={onClear}
                disabled={!hasActiveFilter}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                Clear All
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  disabled={!hasActiveFilter}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply Lens
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// User-configurable Lens Preset Bar
// ============================================================

interface LensPresetBarProps {
  selectedRoles: string[]
  onApplyPreset: (roles: string[]) => void
  availableRoles?: string[]
}

export function LensPresetBar({ selectedRoles, onApplyPreset, availableRoles }: LensPresetBarProps) {
  const roles = availableRoles || getActiveConfig().nodeTypes.map(nt => nt.name)

  // Preset state -- loaded from localStorage on mount
  const [presets, setPresets] = useState<LensPreset[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editingPreset, setEditingPreset] = useState<LensPreset | null>(null)
  const [presetName, setPresetName] = useState('')
  const [presetTypes, setPresetTypes] = useState<string[]>([])
  const formRef = useRef<HTMLDivElement>(null)

  // Load presets on mount
  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  // Close form on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        cancelEditing()
      }
    }
    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEditing])

  const isPresetActive = useCallback((preset: LensPreset) => {
    return (
      preset.nodeTypes.length > 0 &&
      preset.nodeTypes.length === selectedRoles.length &&
      preset.nodeTypes.every(t => selectedRoles.includes(t))
    )
  }, [selectedRoles])

  // ---- CRUD handlers ----

  function startCreate() {
    setEditingPreset(null)
    setPresetName('')
    // Default to current selection if any, otherwise empty
    setPresetTypes(selectedRoles.length > 0 ? [...selectedRoles] : [])
    setIsEditing(true)
  }

  function startEdit(preset: LensPreset) {
    setEditingPreset(preset)
    setPresetName(preset.name)
    setPresetTypes([...preset.nodeTypes])
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditingPreset(null)
    setPresetName('')
    setPresetTypes([])
  }

  function handleSave() {
    const trimmed = presetName.trim()
    if (!trimmed || presetTypes.length === 0) return

    if (editingPreset) {
      updatePreset(editingPreset.id, { name: trimmed, nodeTypes: presetTypes })
    } else {
      createPreset(trimmed, presetTypes)
    }
    setPresets(loadPresets())
    cancelEditing()
  }

  function handleDelete(id: string) {
    deletePreset(id)
    setPresets(loadPresets())
    if (editingPreset?.id === id) cancelEditing()
  }

  function toggleType(type: string) {
    setPresetTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  // ---- Built-in "All" pseudo-preset ----
  const allActive =
    roles.length > 0 &&
    roles.length === selectedRoles.length &&
    roles.every(r => selectedRoles.includes(r))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-600 font-medium">Quick Lenses:</span>

        {/* User presets */}
        {presets.map(preset => (
          <div key={preset.id} className="group relative inline-flex">
            <button
              onClick={() => onApplyPreset(preset.nodeTypes)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                isPresetActive(preset)
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={`Apply "${preset.name}" lens (${preset.nodeTypes.join(', ')})`}
            >
              {preset.name}
            </button>
            {/* Edit/delete on hover */}
            <span className="hidden group-hover:inline-flex items-center gap-0.5 ml-0.5">
              <button
                onClick={() => startEdit(preset)}
                className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
                title="Edit preset"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(preset.id)}
                className="p-0.5 text-gray-400 hover:text-red-600 rounded"
                title="Delete preset"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          </div>
        ))}

        {/* Built-in "All" shortcut */}
        <button
          onClick={() => onApplyPreset(roles)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            allActive
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>

        {/* Add preset button */}
        <button
          onClick={startCreate}
          className="px-2 py-1 rounded text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-dashed border-gray-300 transition-colors"
          title="Create a new lens preset"
        >
          + New Preset
        </button>
      </div>

      {/* Inline create/edit form */}
      {isEditing && (
        <div
          ref={formRef}
          className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3"
        >
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {editingPreset ? 'Edit Preset' : 'New Preset'}
            </label>
            <input
              type="text"
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') cancelEditing()
              }}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {roles.map(type => {
              const isSelected = presetTypes.includes(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                    isSelected
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={cancelEditing}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!presetName.trim() || presetTypes.length === 0}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {editingPreset ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
