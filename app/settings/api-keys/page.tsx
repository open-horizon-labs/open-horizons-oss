import { supabaseServer } from '../../../lib/supabaseServer'
import { ApiKeyManager } from '../components/ApiKeyManager'

export const dynamic = 'force-dynamic'

export default async function ApiKeysSettingsPage() {
  const supabase = await supabaseServer()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Please sign in</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">API Keys</h2>
        <p className="text-gray-600">
          Create and manage API keys for programmatic access to your data.
        </p>
      </div>

      <ApiKeyManager userId={user.id} />
    </div>
  )
}