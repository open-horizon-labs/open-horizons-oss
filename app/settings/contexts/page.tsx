import { ContextsManager } from './ContextsManager'

export const dynamic = 'force-dynamic'

export default async function ContextsSettingsPage() {
  const userId = process.env.DEFAULT_USER_ID || 'default-user'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Contexts</h2>
        <p className="text-gray-600">
          Contexts are workspaces for organizing endeavors.
        </p>
      </div>

      <ContextsManager userId={userId} />
    </div>
  )
}
