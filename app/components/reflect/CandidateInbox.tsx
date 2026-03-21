'use client'

import { useState } from 'react'
import { StoredCandidate, CandidateType, PromoteCandidateRequest } from '../../../lib/contracts/reflect-contract'
import { CandidateCard } from './CandidateCard'

// Form data types matching ReflectModeContainer
type MetisFormData = Pick<PromoteCandidateRequest, 'title' | 'violated_expectation' | 'observed_reality' | 'consequence'>
type GuardrailFormData = Pick<PromoteCandidateRequest, 'title' | 'severity' | 'override_protocol' | 'description'>
type PromoteFormData = MetisFormData | GuardrailFormData

interface CandidateInboxProps {
  candidates: (StoredCandidate & { type: CandidateType })[]
  onPromote: (candidate: StoredCandidate & { type: CandidateType }, formData: PromoteFormData) => Promise<void>
  onReject: (candidate: StoredCandidate & { type: CandidateType }, reason: string) => Promise<void>
  loading?: boolean
}

export function CandidateInbox({ candidates, onPromote, onReject, loading }: CandidateInboxProps) {
  const [filter, setFilter] = useState<'all' | 'metis' | 'guardrail'>('all')

  const filteredCandidates = candidates.filter(c => {
    if (filter === 'all') return true
    return c.type === filter
  })

  const metisCount = candidates.filter(c => c.type === 'metis').length
  const guardrailCount = candidates.filter(c => c.type === 'guardrail').length

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-1/3"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg border p-4 space-y-3 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/4"></div>
            <div className="h-3 bg-gray-100 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-dashed p-8 text-center">
        <p className="text-gray-500 text-sm">No pending candidates</p>
        <p className="text-gray-400 text-xs mt-1">
          Extract candidates from logs to begin reviewing
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded ${
            filter === 'all'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({candidates.length})
        </button>
        <button
          onClick={() => setFilter('metis')}
          className={`px-3 py-1.5 text-sm rounded ${
            filter === 'metis'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Metis ({metisCount})
        </button>
        <button
          onClick={() => setFilter('guardrail')}
          className={`px-3 py-1.5 text-sm rounded ${
            filter === 'guardrail'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Guardrails ({guardrailCount})
        </button>
      </div>

      {/* Candidate list */}
      <div className="space-y-3">
        {filteredCandidates.map(candidate => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onPromote={onPromote}
            onReject={onReject}
          />
        ))}
      </div>

      {filteredCandidates.length === 0 && candidates.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-dashed p-6 text-center">
          <p className="text-gray-500 text-sm">
            No {filter === 'metis' ? 'metis' : 'guardrail'} candidates
          </p>
        </div>
      )}
    </div>
  )
}
