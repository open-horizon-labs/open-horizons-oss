'use client'
import { useState, useTransition } from 'react'
import { GraphNode } from '../../lib/graph/types'
import Link from 'next/link'

interface AimSelectorProps {
  aims: GraphNode[]
  selectedAims: string[]
  onSelectAim: (aimId: string) => Promise<void>
}

export function AimSelector({ aims, selectedAims, onSelectAim }: AimSelectorProps) {
  const [isSelecting, startTransition] = useTransition()
  const [expandedAims, setExpandedAims] = useState<Set<string>>(new Set())

  if (aims.length === 0) {
    return (
      <div className="rounded-lg border p-4 bg-yellow-50">
        <h2 className="font-semibold mb-2">Link to Aims</h2>
        <p className="text-sm text-gray-700 mb-3">
          No Aims defined yet. Create your first Aim to link today&apos;s work.
        </p>
        <Link
          href={`/artifacts/aim:${Date.now()}?type=Aim`}
          className="inline-block px-3 py-1 rounded border bg-white hover:bg-gray-50 text-sm"
        >
          Create First Aim
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Link to Aims</h2>
        <Link
          href={`/artifacts/aim:${Date.now()}?type=Aim`}
          className="px-2 py-1 rounded border text-sm bg-white hover:bg-gray-50"
        >
          New Aim
        </Link>
      </div>
      
      <div className="space-y-2">
        {aims.map(aim => {
          const isSelected = selectedAims.includes(aim.id)
          const isExpanded = expandedAims.has(aim.id)
          
          return (
            <div
              key={aim.id}
              className={`rounded border p-2 ${
                isSelected ? 'border-green-400 bg-green-50' : 'bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => {
                    startTransition(async () => {
                      await onSelectAim(aim.id)
                    })
                  }}
                  disabled={isSelecting}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium text-sm">
                        {aim.title || aim.id}
                      </div>
                      {aim.metadata?.legacy_artifact?.tags && aim.metadata.legacy_artifact.tags.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {aim.metadata.legacy_artifact.tags.map(tag => (
                            <span key={tag} className="inline-block mr-2">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                
                <div className="flex gap-1">
                  <Link
                    href={`/artifacts/${aim.id}?type=Aim`}
                    className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/artifacts/initiative:${Date.now()}?type=Initiative&parent=${aim.id}`}
                    className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50"
                  >
                    + Initiative
                  </Link>
                </div>
              </div>
              
              {isSelected && (
                <div className="mt-2 pt-2 border-t text-xs text-green-700">
                  This Aim is linked to today&apos;s review
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {isSelecting && (
        <div className="mt-2 text-sm text-gray-500">Updating...</div>
      )}
    </div>
  )
}