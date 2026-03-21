import { supabaseServer } from '../../../lib/supabaseServer'
import { DatabaseNodeType } from '../../../lib/contracts/endeavor-contract'
import { EndeavorDetailClient } from '../../components/EndeavorDetailClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ArtifactPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: DatabaseNodeType; parent?: string }>
}) {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId)
  const { type, parent } = await searchParams
  const supabase = await supabaseServer()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div className="text-sm text-gray-700">Please sign in.</div>
  }

  // Load all active nodes first
  let { data: endeavors } = await supabase
    .from('endeavors')
    .select('*')
    .eq('context_id', `personal:${user.id}`)
    .is('archived_at', null)

  let allNodes = (endeavors || []).map(endeavor => ({
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

  let currentNode = allNodes.find(n => n.id === id)

  // If not found in active nodes, check archived nodes
  if (!currentNode) {
    const { data: archivedEndeavors } = await supabase
      .from('endeavors')
      .select('*')
      .eq('context_id', `personal:${user.id}`)
      .not('archived_at', 'is', null)

    const archivedNodes = (archivedEndeavors || []).map(endeavor => ({
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

    currentNode = archivedNodes.find(n => n.id === id)

    // If found in archived, use all nodes including archived for context
    if (currentNode) {
      allNodes = [...allNodes, ...archivedNodes]
    }
  }
  
  // If still no current node exists, this is a new endeavor
  if (!currentNode && !type) {
    return <div className="text-sm text-gray-700">Endeavor not found and no type specified.</div>
  }
  
  const rdfType = currentNode?.node_type || type || 'aim'
  const today = new Date().toISOString().slice(0, 10)
  
  // No auto-creation of default missions

  // Helper to get icon
  const getTypeIcon = (nodeType: string) => {
    const icons: Record<string, string> = {
      mission: '🎯',
      aim: '🏹', 
      initiative: '🚀',
      task: '✓',
      ritual: '🔄',
      strength: '💪',
      goal: '🎪',
      project: '📁',
      practice: '🎯',
      achievement: '🏆'
    }
    return icons[nodeType.toLowerCase()] || '📄'
  }

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          <span>{currentNode ? getTypeIcon(currentNode.node_type) : getTypeIcon(rdfType)}</span>
          {currentNode ? currentNode.title || currentNode.id : `New ${rdfType}`}
        </h1>
        
        {currentNode && (
          <div className="flex gap-2">
            <Link
              href={`/daily/${today}?context=${currentNode.id}`}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded flex items-center gap-2 text-sm font-medium"
              title="Add to today's daily log"
            >
              📝 Daily Log
            </Link>
            <Link
              href={`/endeavors/${currentNode.id}/daily/${today}`}
              className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded flex items-center gap-2 text-sm font-medium"
              title="Open Log Mode interface for this endeavor"
            >
              🚀 Log Mode
            </Link>
          </div>
        )}
      </header>
      
      {currentNode ? (
        <EndeavorDetailClient 
          node={currentNode}
          allNodes={allNodes}
          userId={user.id}
        />
      ) : (
        <EndeavorDetailClient 
          node={{
            id,
            node_type: (rdfType.charAt(0).toUpperCase() + rdfType.slice(1)) as DatabaseNodeType,
            parent_id: parent ? decodeURIComponent(parent) : null,
            title: `New ${rdfType.charAt(0).toUpperCase() + rdfType.slice(1)}`,
            description: '',
            status: 'active',
            metadata: {},
            created_at: new Date().toISOString(),
            archived_at: null
          }}
          allNodes={allNodes}
          userId={user.id}
          isNew={true}
        />
      )}
    </div>
  )
}