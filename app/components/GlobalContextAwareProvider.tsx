import { query } from '../../lib/db'
import { ContextAwareDataProvider } from './ContextAwareDataProvider'

export async function GlobalContextAwareProvider({ children }: { children: React.ReactNode }) {
  const userId = process.env.DEFAULT_USER_ID || 'default-user'

  // Load nodes from default context
  let endeavors: any[] = []
  try {
    endeavors = await query(
      'SELECT * FROM endeavors WHERE context_id = $1 ORDER BY created_at DESC',
      ['default']
    )
  } catch {
    // DB may not be ready yet
  }

  const nodes = endeavors.map(endeavor => ({
    id: endeavor.id,
    node_type: endeavor.node_type?.toLowerCase() || 'task',
    parent_id: endeavor.parent_id || null,
    title: endeavor.title,
    description: endeavor.description || '',
    status: endeavor.status,
    metadata: endeavor.metadata || {},
    created_at: endeavor.created_at,
    archived_at: null
  })) as any[]

  return (
    <ContextAwareDataProvider initialNodes={nodes} userId={userId}>
      {children}
    </ContextAwareDataProvider>
  )
}

export default GlobalContextAwareProvider
