'use client'

import { ImportOptions } from '../../../../lib/import/types'

interface ImportSettingsProps {
  options: Partial<ImportOptions>
  onChange: (options: Partial<ImportOptions>) => void
}

export function ImportSettings({ options, onChange }: ImportSettingsProps) {
  const updatePolicy = (key: string, value: any) => {
    onChange({
      ...options,
      upsert_policy: {
        ...options.upsert_policy,
        [key]: value
      }
    })
  }

  const updateThreshold = (key: 'update' | 'review_band', value: number) => {
    onChange({
      ...options,
      upsert_policy: {
        ...options.upsert_policy,
        similarity_threshold: {
          update: 0.85,
          review_band: 0.75,
          ...options.upsert_policy?.similarity_threshold,
          [key]: value
        }
      }
    })
  }

  const policy = options.upsert_policy || {}
  const thresholds = policy.similarity_threshold || { update: 0.87, review_band: 0.78 }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Import Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure how the import system handles matching and merging content.
        </p>
      </div>

      {/* UPSERT Policy Settings */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Content Handling</h4>
        
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={policy.merge_titles ?? true}
              onChange={(e) => updatePolicy('merge_titles', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-700">Merge similar titles</div>
              <div className="text-xs text-gray-500">
                Combine variations of the same title (recommended)
              </div>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={policy.overwrite_outcome ?? false}
              onChange={(e) => updatePolicy('overwrite_outcome', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-700">Overwrite existing outcomes</div>
              <div className="text-xs text-gray-500">
                Replace existing summaries with new ones (use with caution)
              </div>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={policy.auto_link ?? false}
              onChange={(e) => updatePolicy('auto_link', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="text-sm font-medium text-gray-700">Auto-link review band matches</div>
              <div className="text-xs text-gray-500">
                Automatically link items with medium similarity (78-87%)
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Similarity Thresholds */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Similarity Thresholds</h4>
        <p className="text-xs text-gray-600">
          Configure when to update existing content vs. create new content
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Update Threshold: {(thresholds.update * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.7"
              max="0.95"
              step="0.01"
              value={thresholds.update}
              onChange={(e) => updateThreshold('update', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>70%</span>
              <span>95%</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Content with similarity ≥ {(thresholds.update * 100).toFixed(0)}% will be updated
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Review Band Threshold: {(thresholds.review_band * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.5"
              max="0.85"
              step="0.01"
              value={thresholds.review_band}
              onChange={(e) => updateThreshold('review_band', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>50%</span>
              <span>85%</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Content with similarity {(thresholds.review_band * 100).toFixed(0)}%-{(thresholds.update * 100).toFixed(0)}% will be flagged for review
            </p>
          </div>
        </div>
      </div>

      {/* Threshold Visualization */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Decision Matrix</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>≥ {(thresholds.update * 100).toFixed(0)}% similarity → UPDATE existing content</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>{(thresholds.review_band * 100).toFixed(0)}%-{(thresholds.update * 100).toFixed(0)}% similarity → FLAG for review {policy.auto_link ? '(auto-link enabled)' : ''}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>&lt; {(thresholds.review_band * 100).toFixed(0)}% similarity → INSERT as new content</span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Recommendations</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Conservative:</strong> Use higher thresholds (90%+ update, 85%+ review) to minimize false matches</li>
          <li>• <strong>Aggressive:</strong> Use lower thresholds (80%+ update, 70%+ review) to maximize content consolidation</li>
          <li>• <strong>Balanced:</strong> Default settings (87%+ update, 78%+ review) work well for most cases</li>
          <li>• Enable auto-link for review band if you trust the similarity matching</li>
        </ul>
      </div>
    </div>
  )
}