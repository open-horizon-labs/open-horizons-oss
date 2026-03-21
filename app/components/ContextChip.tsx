"use client"
import { useMemo, useState, useTransition, useEffect, useRef } from 'react'
import { GraphNode } from '../../lib/contracts/endeavor-contract'
import { down, sideways, up, ancestors } from '../../lib/graph/traverse'

export function ContextChip(props: {
  nodes: GraphNode[]
  activeId: string
  onSelect: (id: string) => Promise<void> | void
}) {
  const { nodes, activeId, onSelect } = props
  const active = useMemo(() => nodes.find((n) => n.id === activeId), [nodes, activeId])
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const ancestorNodes = ancestors(nodes, activeId)
  const children = down(nodes, activeId)
  const lateral = sideways(nodes, activeId)
  const roots = useMemo(() => nodes.filter((n) => !n.parent_id), [nodes])

  // Handle click outside and keyboard events
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [open])

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded border text-sm bg-white hover:bg-gray-50"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isPending}
      >
        <span className="text-xs">📍</span>
        {active ? `${active.node_type}: ${active.title ?? active.id}` : 'Select Context'}
        {isPending ? (
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-64 rounded-md border bg-white shadow">
          <div className="max-h-72 overflow-auto">
            {!active && <MenuSection label="Pick Context" items={roots} onSelect={select} />}
            <MenuSection label="Ancestors (↑)" items={ancestorNodes.slice().reverse()} onSelect={select} />
            <div className="p-2 border-y bg-blue-50">
              <div className="text-xs text-blue-600 font-medium">ACTIVE</div>
              <div className="text-sm font-medium truncate text-blue-900">{active?.title ?? active?.id ?? '—'}</div>
            </div>
            <MenuSection label="Children" items={children} onSelect={select} />
            <MenuSection label="Related" items={lateral} onSelect={select} />
          </div>
        </div>
      )}
    </div>
  )

  function select(id: string) {
    setOpen(false)
    startTransition(async () => {
      await onSelect(id)
    })
  }
}

function MenuSection({
  label,
  items,
  onSelect
}: {
  label: string
  items: GraphNode[]
  onSelect: (id: string) => void
}) {
  if (!items || items.length === 0) return null
  return (
    <div className="p-2 border-b last:border-b-0">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {items.map((n) => (
        <button
          key={n.id}
          onClick={() => onSelect(n.id)}
          className="block w-full text-left px-2 py-1 rounded hover:bg-gray-50 text-sm truncate"
        >
          {n.title ?? n.id} <span className="text-gray-500">({n.node_type})</span>
        </button>
      ))}
    </div>
  )
}
