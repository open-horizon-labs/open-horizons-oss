import { Suspense } from 'react'
import { query } from '../../lib/db'
import { ContextAwareDataProvider } from './ContextAwareDataProvider'

export async function GlobalContextAwareProvider({ children }: { children: React.ReactNode }) {
  const userId = process.env.DEFAULT_USER_ID || 'default-user'

  // Load nodes from default context
  let endeavors: any[] = []
  let edges: any[] = []
  try {
    endeavors = await query(
      'SELECT * FROM endeavors WHERE context_id = $1 ORDER BY created_at DESC',
      ['default']
    )
    const endeavorIds = endeavors.map(e => e.id)
    if (endeavorIds.length > 0) {
      edges = await query(
        'SELECT from_endeavor_id, to_endeavor_id FROM edges WHERE relationship = $1 AND to_endeavor_id = ANY($2)',
        ['contains', endeavorIds]
      )
    }
  } catch {
    // DB may not be ready yet
  }

  // Build parent_id map from edges
  const parentMap = new Map<string, string>()
  for (const edge of edges) {
    parentMap.set(edge.to_endeavor_id, edge.from_endeavor_id)
  }

  const nodes = endeavors.map(endeavor => ({
    id: endeavor.id,
    node_type: endeavor.node_type,
    parent_id: parentMap.get(endeavor.id) || null,
    title: endeavor.title,
    description: endeavor.description || '',
    status: endeavor.status,
    metadata: endeavor.metadata || {},
    created_at: endeavor.created_at,
    archived_at: null
  })) as any[]

  return (
    <Suspense fallback={null}>
      <ContextAwareDataProvider initialNodes={nodes} userId={userId}>
        {children}
      </ContextAwareDataProvider>
    </Suspense>
  )
}

export default GlobalContextAwareProvider
