'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useContextAwareData } from './ContextAwareDataProvider'
import { ContextBreadcrumb } from './ContextBreadcrumb'
import { ChangeParentModal } from './ChangeParentModal'
import { AutoSaveEditor } from './AutoSaveEditor'
import { getEndeavorLink } from '../../lib/utils/endeavor-links'
import { buildContextAwareBreadcrumbs } from '../../lib/ui/breadcrumb-utils'
import Link from 'next/link'

function CopyShortId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const shortId = id.slice(0, 8)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.warn('Failed to copy to clipboard')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-400 hover:text-gray-600 font-mono bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors"
      title={`Copy short ID: ${shortId}`}
    >
      {copied ? 'copied!' : shortId}
    </button>
  )
}

interface EndeavorPageClientProps {
  id: string
  date: string
  userId: string
  contextId?: string
}

export function EndeavorPageClient({
  id,
  date,
  userId,
  contextId: urlContextId,
}: EndeavorPageClientProps) {
  const { nodes, selectedContextId, ensureNodeIncluded, reloadNodes } = useContextAwareData()
  const effectiveContextId = urlContextId || selectedContextId
  const router = useRouter()
  const [showChangeParentModal, setShowChangeParentModal] = useState(false)

  useEffect(() => {
    if (urlContextId && urlContextId !== selectedContextId) {
      localStorage.setItem('selectedContextId', urlContextId)
      window.dispatchEvent(new CustomEvent('contextChanged', { detail: { contextId: urlContextId } }))
    }
  }, [urlContextId, selectedContextId])

  const endeavor = nodes.find(n => n.id === id)

  if (!endeavor) {
    return <div>Loading endeavor...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-4 mb-2">
          <ContextBreadcrumb contextId={effectiveContextId} />
        </div>

        <nav className="text-sm text-gray-600 mb-2 flex flex-wrap items-center gap-1">
          {buildContextAwareBreadcrumbs(endeavor, nodes).map((ancestor) => (
            <span key={ancestor.id}>
              <Link href={getEndeavorLink(ancestor.id, date)} className="hover:underline">
                {ancestor.title || ancestor.id}
              </Link>
              <span className="mx-2">&rarr;</span>
            </span>
          ))}
          <span className="font-medium">{endeavor.title || endeavor.id}</span>
        </nav>

        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{endeavor.title || endeavor.id}</h1>
          <CopyShortId id={id} />
        </div>

        {endeavor.node_type?.toLowerCase() !== 'mission' && (
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
            <span>Parent:</span>
            {endeavor.parent_id ? (
              (() => {
                const parentNode = nodes.find(n => n.id === endeavor.parent_id)
                return parentNode ? (
                  <Link href={getEndeavorLink(parentNode.id, date)} className="text-blue-600 hover:underline">
                    {parentNode.title || parentNode.id}
                  </Link>
                ) : (
                  <span className="text-gray-400">{endeavor.parent_id}</span>
                )
              })()
            ) : (
              <span className="text-gray-400 italic">None (root level)</span>
            )}
            <button
              onClick={() => setShowChangeParentModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              [Edit]
            </button>
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
        <AutoSaveEditor
          initialValue={endeavor.description || ''}
          onSave={async (value) => {
            await fetch(`/api/endeavors/${encodeURIComponent(id)}/description`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ description: value })
            })
          }}
        />
      </div>

      <ChangeParentModal
        visible={showChangeParentModal}
        onHide={() => setShowChangeParentModal(false)}
        endeavorId={id}
        endeavorTitle={endeavor.title || endeavor.id}
        currentParentId={endeavor.parent_id}
        nodeType={endeavor.node_type as any}
        allNodes={nodes}
        onChanged={() => { reloadNodes(); router.refresh() }}
      />
    </div>
  )
}
