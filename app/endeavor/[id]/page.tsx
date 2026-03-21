import { supabaseServer } from '../../../lib/supabaseServer'
import { DailyFrontMatter } from '../../../lib/graph/types'
import { EndeavorPageClient } from '../../components/EndeavorPageClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{ date?: string }>
}

export default async function EndeavorPage({ params, searchParams }: Props) {
  const { id } = await params
  const { date: dateParam } = await searchParams
  const date = dateParam || new Date().toISOString().slice(0, 10)

  const supabase = await supabaseServer()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div>Please sign in</div>
  }

  // Fetch the endeavor directly by ID (IDs are now unique UUIDs)
  const { data: endeavor, error } = await supabase
    .from('endeavors')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !endeavor) {
    // Check if this is an old-format ID and redirect
    if (id.includes(':')) {
      return (
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-yellow-800 mb-2">Old URL format</h2>
            <p className="text-yellow-700 mb-4">
              This URL uses an old ID format. Please update your bookmarks.
            </p>
            <a href="/dashboard" className="text-blue-600 hover:underline">
              Go to Dashboard
            </a>
          </div>
        </div>
      )
    }

    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="text-center text-gray-500">
          <h2 className="text-lg font-medium mb-2">Endeavor not found</h2>
          <p>The endeavor could not be found or you don&apos;t have access.</p>
        </div>
      </div>
    )
  }

  // Load all endeavors in the same context for tree navigation
  const { data: endeavors } = await supabase
    .from('endeavors')
    .select('*')
    .eq('context_id', endeavor.context_id)
    .is('archived_at', null)

  const basicNodes = (endeavors || []).map(e => ({
    id: e.id,
    node_type: e.node_type?.toLowerCase() || 'task',
    parent_id: e.parent_id,
    title: e.title,
    description: e.description || '',
    status: e.status,
    metadata: e.metadata || {},
    created_at: e.created_at,
    archived_at: e.archived_at
  })) as any[]

  // Load daily log entry using correct logs table schema
  const { data: logEntry } = await supabase
    .from('logs')
    .select('content, metadata')
    .eq('user_id', user.id)
    .eq('log_date', date)
    .eq('entity_type', 'endeavor')
    .eq('entity_id', id)
    .single()

  const body = logEntry?.content || ''
  const frontMatter: DailyFrontMatter = logEntry?.metadata || {
    date,
    endeavor_id: id
  }

  async function saveBodyOnly(newBody: string) {
    'use server'

    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    await supabase
      .from('logs')
      .upsert({
        user_id: user.id,
        log_date: date,
        entity_type: 'endeavor',
        entity_id: id,
        content: newBody,
        content_type: 'markdown',
        metadata: frontMatter
      }, {
        onConflict: 'user_id,entity_type,entity_id,log_date'
      })
  }

  return (
    <EndeavorPageClient
      id={id}
      date={date}
      userId={user.id}
      contextId={endeavor.context_id}
      initialBody={body}
      initialFrontMatter={frontMatter}
      onSaveBodyOnly={saveBodyOnly}
      onApplyReviewEdit={async () => {
        'use server'
      }}
    />
  )
}
