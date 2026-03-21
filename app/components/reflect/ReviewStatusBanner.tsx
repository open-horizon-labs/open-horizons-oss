'use client'

import { ReviewStatusResponse } from '../../../lib/contracts/reflect-contract'

interface ReviewStatusBannerProps {
  status: ReviewStatusResponse | null
  loading: boolean
  onExtract: () => void
  extracting: boolean
}

export function ReviewStatusBanner({ status, loading, onExtract, extracting }: ReviewStatusBannerProps) {
  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg border p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
        <p className="text-yellow-800 text-sm">Unable to load review status</p>
      </div>
    )
  }

  const { should_trigger, trigger_reason, pending_candidates, logs_since_review, days_since_review, last_reviewed_at } = status

  // Determine banner style based on trigger status
  const bannerStyle = should_trigger
    ? 'bg-amber-50 border-amber-200'
    : 'bg-green-50 border-green-200'

  const textStyle = should_trigger
    ? 'text-amber-900'
    : 'text-green-900'

  const subtextStyle = should_trigger
    ? 'text-amber-700'
    : 'text-green-700'

  return (
    <div className={`rounded-lg border p-4 ${bannerStyle}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className={`font-medium flex items-center gap-2 ${textStyle}`}>
            <span aria-hidden="true">{should_trigger ? '🔔' : '✓'}</span>
            <span>{should_trigger ? 'Review Needed' : 'Review Status'}</span>
          </h3>
          <div className={`text-sm mt-1 space-y-1 ${subtextStyle}`}>
            {should_trigger ? (
              <>
                <p>
                  {trigger_reason === 'item_threshold' && `${pending_candidates} items ready for review`}
                  {trigger_reason === 'time_threshold' && days_since_review !== null && `${days_since_review} days since last review`}
                </p>
                <p className="text-xs opacity-75">
                  {logs_since_review} log entries since last review
                </p>
              </>
            ) : (
              <>
                <p>No review needed right now</p>
                {last_reviewed_at && (
                  <p className="text-xs opacity-75">
                    Last reviewed: {(() => {
                      const date = new Date(last_reviewed_at)
                      return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString()
                    })()}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <button
          onClick={onExtract}
          disabled={extracting || logs_since_review === 0}
          aria-busy={extracting}
          aria-label={extracting ? 'Extracting candidates from logs' : 'Extract candidates from logs'}
          className={`px-3 py-2 text-sm rounded flex items-center gap-2 ${
            extracting || logs_since_review === 0
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {extracting ? (
            <>
              <span className="animate-spin" aria-hidden="true">⟳</span>
              Extracting...
            </>
          ) : (
            <>
              <span aria-hidden="true">✨</span>
              Extract from Logs
            </>
          )}
        </button>
      </div>
    </div>
  )
}
