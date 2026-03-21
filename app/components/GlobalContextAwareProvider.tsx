import { supabaseServer } from '../../lib/supabaseServer'
import { ContextAwareDataProvider } from './ContextAwareDataProvider'

export async function GlobalContextAwareProvider({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return <>{children}</>
  }

  // Load nodes directly using contract format
  const { data: endeavors } = await supabase
    .from('endeavors')
    .select('*')
    .eq('context_id', `personal:${user.id}`)
    .is('archived_at', null)

  // Convert to modern format (components expect GraphNode with correct field names)
  const nodes = (endeavors || []).map(endeavor => ({
    id: endeavor.id,
    node_type: endeavor.node_type?.toLowerCase() || 'task',
    parent_id: endeavor.parent_id,
    title: endeavor.title,
    description: endeavor.description || '',
    status: endeavor.status,
    metadata: endeavor.metadata || {},
    created_at: endeavor.created_at,
    archived_at: endeavor.archived_at
  })) as any[]

  return (
    <ContextAwareDataProvider initialNodes={nodes} userId={user.id}>
      {children}
    </ContextAwareDataProvider>
  )
}

export default GlobalContextAwareProvider