import { redirect } from 'next/navigation'
import { supabaseServer } from '../../lib/supabaseServer'
import { ArchivedEndeavorsClient } from '../components/ArchivedEndeavorsClient'

export const dynamic = 'force-dynamic'

export default async function ArchivedPage() {
  const supabase = await supabaseServer()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const userId = user.id

  // Load archived endeavors directly
  const { data: endeavors, error } = await supabase
    .from('endeavors')
    .select('*')
    .eq('context_id', `personal:${userId}`)
    .not('archived_at', 'is', null) // Only archived endeavors
    .order('archived_at', { ascending: false }) // Most recently archived first

  // Map database fields to GraphNode contract
  const archivedNodes = (endeavors || []).map(endeavor => ({
    id: endeavor.id,
    node_type: endeavor.node_type,
    parent_id: endeavor.parent_id,
    title: endeavor.title,
    description: endeavor.description || '',
    status: endeavor.status,
    metadata: endeavor.metadata || {},
    created_at: endeavor.created_at,
    archived_at: endeavor.archived_at,
    archivedReason: endeavor.archived_reason // Map snake_case DB field to camelCase legacy field
  })) as any[]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archived Endeavors</h1>
          <p className="text-gray-600 mt-1">
            View and manage your archived endeavors. These are excluded from most views but preserved in the graph.
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {archivedNodes.length} archived endeavor{archivedNodes.length !== 1 ? 's' : ''}
        </div>
      </div>

      <ArchivedEndeavorsClient 
        archivedNodes={archivedNodes}
        userId={userId}
      />
    </div>
  )
}