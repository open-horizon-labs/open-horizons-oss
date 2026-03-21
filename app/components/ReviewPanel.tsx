"use client"
import { useState } from 'react'
import { GraphNode } from '../../lib/contracts/endeavor-contract'
import { DailyFrontMatter } from '../../lib/graph/types'
import { generateReview } from '../../lib/review/generate'

export function ReviewPanel(props: {
  body: string
  fm: DailyFrontMatter
  activeNode?: GraphNode
  onApply: (edits: { block: 'done' | 'aims' | 'next' | 'reflection'; mode: 'append' | 'replace'; content: string }) => void
  userId?: string
  date?: string
}) {
  const { body, fm, activeNode, onApply, userId, date } = props
  const [gen, setGen] = useState<null | Awaited<ReturnType<typeof generateReview>>>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold">Synthesize Daily Note</h2>
          <p className="text-xs text-gray-600 mt-1">Transform your running log into structured Daily Note blocks</p>
        </div>
        <button
          className="px-3 py-1 rounded border text-sm bg-white hover:bg-gray-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const result = await generateReview({ body, fm, activeNode, attachments: [], userId, date })
              setGen(result)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Synthesizing…' : 'Synthesize Daily Note'}
        </button>
      </div>
      {!gen && (
        <div className="text-sm text-gray-600">
          <p className="mb-2">Click &quot;Synthesize&quot; to transform your running log into formal Daily Note blocks:</p>
          <ul className="text-xs space-y-1 ml-4">
            <li>• <strong>Done:</strong> Key accomplishments from your log</li>
            <li>• <strong>Context Links:</strong> How today&apos;s work advanced this context</li>
            <li>• <strong>Next:</strong> Priority items for tomorrow</li>
            <li>• <strong>Reflection:</strong> Wins, learnings, and adjustments</li>
          </ul>
        </div>
      )}
      {gen && (
        <div className="space-y-4">
          {(['done', 'aims', 'next', 'reflection'] as const).map((k) => (
            <BlockDiff
              key={k}
              title={sectionTitle(k)}
              proposed={gen.blocks[k]}
              onAppend={() => onApply({ block: k, mode: 'append', content: gen.blocks[k] })}
              onReplace={() => onApply({ block: k, mode: 'replace', content: gen.blocks[k] })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BlockDiff({
  title,
  proposed,
  onAppend,
  onReplace
}: {
  title: string
  proposed: string
  onAppend: () => void
  onReplace: () => void
}) {
  return (
    <div className="border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{title}</div>
        <div className="flex gap-2">
          <button className="px-2 py-1 border rounded text-sm" onClick={onAppend}>
            Append
          </button>
          <button className="px-2 py-1 border rounded text-sm" onClick={onReplace}>
            Replace
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Proposed</div>
          <textarea className="w-full border rounded p-2 h-28" readOnly value={proposed} />
        </div>
      </div>
    </div>
  )
}

function sectionTitle(key: 'done' | 'aims' | 'next' | 'reflection'): string {
  if (key === 'done') return 'Done'
  if (key === 'aims') return 'Context Links'
  if (key === 'next') return 'Next (1–5)'
  return 'Reflection — Win • Learning • Adjust'
}

