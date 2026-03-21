'use client'

import { useState, useEffect, useCallback } from 'react'
import { ReviewStatusBanner } from './ReviewStatusBanner'
import { CandidateInbox } from './CandidateInbox'
import { ActiveKnowledgeView } from './ActiveKnowledgeView'
import {
  ReviewStatusResponse,
  ActiveKnowledgeResponse,
  StoredCandidate,
  CandidateType,
  PromoteCandidateRequest
} from '../../../lib/contracts/reflect-contract'

// Form data types for promotion (excludes candidate_id and type which are added by handler)
type MetisFormData = Pick<PromoteCandidateRequest, 'title' | 'violated_expectation' | 'observed_reality' | 'consequence'>
type GuardrailFormData = Pick<PromoteCandidateRequest, 'title' | 'severity' | 'override_protocol' | 'description'>
type PromoteFormData = MetisFormData | GuardrailFormData

interface ReflectModeContainerProps {
  endeavorId: string
}

export function ReflectModeContainer({ endeavorId }: ReflectModeContainerProps) {
  const [activeView, setActiveView] = useState<'review' | 'knowledge'>('review')

  // Status state
  const [status, setStatus] = useState<ReviewStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  // Knowledge state
  const [knowledge, setKnowledge] = useState<ActiveKnowledgeResponse | null>(null)
  const [knowledgeLoading, setKnowledgeLoading] = useState(true)
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null)

  // Candidates for review (extracted from knowledge response)
  const [candidates, setCandidates] = useState<(StoredCandidate & { type: CandidateType })[]>([])

  // Extract state
  const [extracting, setExtracting] = useState(false)

  // Complete review state
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  // Fetch status with contract validation
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/reflect/status/${endeavorId}`)
      if (response.ok) {
        const data = await response.json()
        // Runtime validation using Zod schema
        const validated = ReviewStatusResponse.safeParse(data)
        if (validated.success) {
          setStatus(validated.data)
        } else {
          console.error('Invalid status response:', validated.error)
        }
      }
    } catch (error) {
      console.error('Failed to fetch status:', error)
    } finally {
      setStatusLoading(false)
    }
  }, [endeavorId])

  // Fetch knowledge with contract validation
  const fetchKnowledge = useCallback(async () => {
    try {
      const response = await fetch(`/api/reflect/knowledge/${endeavorId}`)
      if (response.ok) {
        const data = await response.json()
        // Runtime validation using Zod schema
        const validated = ActiveKnowledgeResponse.safeParse(data)
        if (validated.success) {
          setKnowledge(validated.data)
          setKnowledgeError(null)
          // pending_candidates already validated, type is guaranteed correct
          setCandidates(validated.data.pending_candidates.map(c => ({
            ...c,
            type: c.type
          })))
        } else {
          console.error('Invalid knowledge response:', validated.error)
          setKnowledgeError(`Contract validation failed: ${validated.error.message}`)
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setKnowledgeError(`API error (${response.status}): ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to fetch knowledge:', error)
      setKnowledgeError(error instanceof Error ? error.message : 'Network error')
    } finally {
      setKnowledgeLoading(false)
    }
  }, [endeavorId])

  // Initial fetch
  useEffect(() => {
    fetchStatus()
    fetchKnowledge()
  }, [fetchStatus, fetchKnowledge])

  // Extract candidates from logs
  const handleExtract = async () => {
    setExtracting(true)
    try {
      const response = await fetch('/api/reflect/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endeavor_id: endeavorId,
          include_children: true,
          include_parent: true,
          include_siblings: true
        })
      })

      if (response.ok) {
        // Refresh both status and knowledge after extraction
        await Promise.all([fetchStatus(), fetchKnowledge()])
      } else {
        const error = await response.json()
        console.error('Extraction failed:', error)
      }
    } catch (error) {
      console.error('Extraction error:', error)
    } finally {
      setExtracting(false)
    }
  }

  // Promote a candidate with typed form data
  const handlePromote = async (
    candidate: StoredCandidate & { type: CandidateType },
    formData: PromoteFormData
  ) => {
    try {
      const response = await fetch('/api/reflect/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidate.id,
          type: candidate.type,
          ...formData
        })
      })

      if (response.ok) {
        // Remove from local candidates and refresh knowledge
        setCandidates(prev => prev.filter(c => c.id !== candidate.id))
        await fetchKnowledge()
        await fetchStatus()
      } else {
        const error = await response.json()
        console.error('Promote failed:', error)
        throw new Error(error.error || 'Promotion failed')
      }
    } catch (error) {
      console.error('Promote error:', error)
      throw error
    }
  }

  // Reject a candidate
  const handleReject = async (
    candidate: StoredCandidate & { type: CandidateType },
    reason: string
  ) => {
    try {
      const response = await fetch('/api/reflect/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidate.id,
          type: candidate.type,
          reason
        })
      })

      if (response.ok) {
        // Remove from local candidates
        setCandidates(prev => prev.filter(c => c.id !== candidate.id))
        await fetchStatus()
      } else {
        const error = await response.json()
        console.error('Reject failed:', error)
        throw new Error(error.error || 'Rejection failed')
      }
    } catch (error) {
      console.error('Reject error:', error)
      throw error
    }
  }

  // Complete review session with loading state and error feedback
  const handleCompleteReview = async () => {
    setCompleting(true)
    setCompleteError(null)
    try {
      const response = await fetch('/api/reflect/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endeavor_id: endeavorId })
      })

      if (response.ok) {
        await fetchStatus()
      } else {
        const error = await response.json()
        setCompleteError(error.error || 'Failed to complete review')
      }
    } catch (error) {
      console.error('Complete review error:', error)
      setCompleteError('Network error - please try again')
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <ReviewStatusBanner
        status={status}
        loading={statusLoading}
        onExtract={handleExtract}
        extracting={extracting}
      />

      {/* View Toggle - using custom tabs; PrimeReact TabView deferred for consistency review */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => setActiveView('review')}
          className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
            activeView === 'review'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Review Queue {candidates.length > 0 && `(${candidates.length})`}
        </button>
        <button
          onClick={() => setActiveView('knowledge')}
          className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
            activeView === 'knowledge'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Knowledge Base
        </button>
      </div>

      {/* Content */}
      {activeView === 'review' ? (
        <div className="space-y-4">
          <CandidateInbox
            candidates={candidates}
            onPromote={handlePromote}
            onReject={handleReject}
            loading={knowledgeLoading}
          />

          {/* Complete Review Button */}
          {candidates.length === 0 && !knowledgeLoading && (
            <div className="flex flex-col items-center gap-2 pt-4">
              <button
                onClick={handleCompleteReview}
                disabled={completing}
                className={`px-4 py-2 text-sm rounded ${
                  completing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                } text-white`}
              >
                {completing ? 'Completing...' : 'Mark Review Complete'}
              </button>
              {completeError && (
                <p className="text-sm text-red-600">{completeError}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <ActiveKnowledgeView
          knowledge={knowledge}
          loading={knowledgeLoading}
          error={knowledgeError}
        />
      )}
    </div>
  )
}
