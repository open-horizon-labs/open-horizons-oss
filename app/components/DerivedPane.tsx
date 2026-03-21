'use client'
import { DerivedDescriptor } from '../../lib/graph/types'

interface DerivedPaneProps {
  derived: DerivedDescriptor[]
  primaryIndex?: number
  onSetPrimary: (index: number) => void
  onRegenerate: () => void
  isRegenerating?: boolean
}

export function DerivedPane({
  derived,
  primaryIndex,
  onSetPrimary,
  onRegenerate,
  isRegenerating
}: DerivedPaneProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Extracted Descriptors</h2>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="px-3 py-1 rounded border text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>

        {derived.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            Save your raw text to generate structured descriptors
          </div>
        ) : (
          <div className="space-y-3">
            {derived.map((candidate, index) => (
              <CandidateCard
                key={index}
                candidate={candidate}
                index={index}
                isPrimary={primaryIndex === index}
                onSetPrimary={() => onSetPrimary(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview of primary */}
      {primaryIndex !== undefined && derived[primaryIndex] && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-sm font-medium text-green-900 mb-2">
            Primary Reference
          </h3>
          <div className="text-sm text-green-800">
            <div className="font-medium">{derived[primaryIndex].title}</div>
            <div className="mt-1 text-green-700">{derived[primaryIndex].summary}</div>
          </div>
          <div className="mt-2 text-xs text-green-600">
            This will be shown in navigation and references
          </div>
        </div>
      )}
    </div>
  )
}

function CandidateCard({
  candidate,
  index,
  isPrimary,
  onSetPrimary
}: {
  candidate: DerivedDescriptor
  index: number
  isPrimary: boolean
  onSetPrimary: () => void
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        isPrimary ? 'border-green-400 bg-green-50' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-medium text-sm">{candidate.title}</div>
          <div className="text-sm text-gray-600 mt-1">{candidate.summary}</div>
          {candidate.confidence && (
            <div className="mt-2 text-xs text-gray-500">
              Confidence: {Math.round(candidate.confidence * 100)}%
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {!isPrimary && (
            <button
              onClick={onSetPrimary}
              className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50"
            >
              Set Primary
            </button>
          )}
          {isPrimary && (
            <span className="px-2 py-1 rounded bg-green-600 text-white text-xs text-center">
              Primary
            </span>
          )}
        </div>
      </div>
    </div>
  )
}