import { supabaseServer } from '../../../lib/supabaseServer'
import { ContextsManager } from './ContextsManager'

export const dynamic = 'force-dynamic'

export default async function ContextsSettingsPage() {
  const supabase = await supabaseServer()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Please sign in</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Collaboration Contexts</h2>
        <p className="text-gray-600">
          Contexts are collaboration spaces where you can share specific endeavors with others.
          Each context isolates shared work from your personal workspace.
        </p>
      </div>

      <ContextsManager userId={user.id} />
    </div>
  )
}