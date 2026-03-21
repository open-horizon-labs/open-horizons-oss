"use client"
import { DailyFrontMatter, ReviewBlocks } from '../../lib/graph/types'
import { contextSet, nextCount, presenceBlocks, reflectionTriad } from '../../lib/validators'

export function ValidatorPane({ fm, blocks }: { fm: DailyFrontMatter | null; blocks: ReviewBlocks }) {
  const c = contextSet(fm)
  const p = presenceBlocks(blocks)
  const n = nextCount(blocks)
  const r = reflectionTriad(blocks)
  const warns = [...p.warns, n.warn, r.warn].filter(Boolean) as string[]

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-3">
        <h2 className="font-semibold">Daily Note Quality</h2>
        <p className="text-xs text-gray-600 mt-1">Validate synthesized Daily Note blocks from your running log</p>
      </div>
      {!c.ok && (
        <div className="mb-2 text-red-700 border border-red-200 bg-red-50 rounded p-2 text-sm">
          Error: {c.error}
        </div>
      )}
      <div className="text-sm text-gray-800 space-y-1">
        <div>
          Context set: <span className="font-medium">{c.ok ? 'Yes' : 'No'}</span>
        </div>
        <div>
          Warnings: <span className="font-medium">{warns.length}</span>
        </div>
        {warns.length > 0 && (
          <ul className="list-disc ml-5 text-gray-700">
            {warns.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

