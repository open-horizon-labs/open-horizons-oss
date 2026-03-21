'use client'

import { useState } from 'react'
import { StoredCandidate, CandidateType, PromoteCandidateRequest } from '../../../lib/contracts/reflect-contract'

// Form data types matching parent components
type MetisFormData = Pick<PromoteCandidateRequest, 'title' | 'violated_expectation' | 'observed_reality' | 'consequence'>
type GuardrailFormData = Pick<PromoteCandidateRequest, 'title' | 'severity' | 'override_protocol' | 'description'>
type PromoteFormData = MetisFormData | GuardrailFormData

interface CandidateCardProps {
  candidate: StoredCandidate & { type: CandidateType }
  onPromote: (candidate: StoredCandidate & { type: CandidateType }, formData: PromoteFormData) => Promise<void>
  onReject: (candidate: StoredCandidate & { type: CandidateType }, reason: string) => Promise<void>
}

export function CandidateCard({ candidate, onPromote, onReject }: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  // Form state for promotion
  const [title, setTitle] = useState(candidate.content.slice(0, 100))
  const [violatedExpectation, setViolatedExpectation] = useState(candidate.violated_expectation || '')
  const [observedReality, setObservedReality] = useState(candidate.observed_reality || '')
  const [consequence, setConsequence] = useState(candidate.consequence || '')
  const [overrideProtocol, setOverrideProtocol] = useState(candidate.override_protocol || '')
  const [severity, setSeverity] = useState<'hard' | 'soft' | 'advisory'>(
    (candidate.severity as 'hard' | 'soft' | 'advisory') || 'soft'
  )

  const isMetis = candidate.type === 'metis'

  const handlePromote = async () => {
    setPromoting(true)
    try {
      const formData = isMetis
        ? {
            title,
            violated_expectation: violatedExpectation,
            observed_reality: observedReality,
            consequence
          }
        : {
            title,
            severity,
            override_protocol: overrideProtocol
          }
      await onPromote(candidate, formData)
    } finally {
      setPromoting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setRejecting(true)
    try {
      await onReject(candidate, rejectReason)
    } finally {
      setRejecting(false)
    }
  }

  const canPromote = isMetis
    ? title && violatedExpectation && observedReality && consequence
    : title && overrideProtocol

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            isMetis ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {isMetis ? '💡 Metis' : '🛡️ Guardrail'}
          </span>
          <span className={`text-xs px-2 py-1 rounded ${
            candidate.confidence === 'high' ? 'bg-green-100 text-green-700' :
            candidate.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {candidate.confidence || 'medium'} confidence
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Content preview */}
      <p className="text-sm text-gray-700">{candidate.content}</p>

      {/* Expanded form */}
      {expanded && (
        <div className="pt-3 border-t space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Short, descriptive title"
            />
          </div>

          {isMetis ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  What was expected? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={violatedExpectation}
                  onChange={(e) => setViolatedExpectation(e.target.value)}
                  className="w-full p-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="What did you expect to happen?"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  What actually happened? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={observedReality}
                  onChange={(e) => setObservedReality(e.target.value)}
                  className="w-full p-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="What was the actual outcome?"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Why did it matter? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={consequence}
                  onChange={(e) => setConsequence(e.target.value)}
                  className="w-full p-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="What was the impact of this difference?"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as 'hard' | 'soft' | 'advisory')}
                  className="w-full p-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="advisory">Advisory (inform only)</option>
                  <option value="soft">Soft (require rationale to override)</option>
                  <option value="hard">Hard (block without approval)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Override Protocol <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={overrideProtocol}
                  onChange={(e) => setOverrideProtocol(e.target.value)}
                  className="w-full p-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="How can this guardrail be bypassed when necessary?"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handlePromote}
              disabled={!canPromote || promoting}
              className={`px-3 py-1.5 text-sm rounded ${
                canPromote && !promoting
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {promoting ? 'Promoting...' : '✓ Promote'}
            </button>

            {!rejecting ? (
              <button
                onClick={() => setRejecting(true)}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
              >
                ✗ Reject
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection..."
                  className="flex-1 p-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setRejecting(false)}
                  className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed quick actions */}
      {!expanded && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(true)}
            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Review
          </button>
        </div>
      )}
    </div>
  )
}
