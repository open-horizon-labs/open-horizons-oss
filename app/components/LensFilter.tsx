'use client'

import { useState, useRef, useEffect } from 'react'
import { SingleRoleChip } from './NodeTypeChips'
import { getActiveConfig } from '../../lib/config'

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
