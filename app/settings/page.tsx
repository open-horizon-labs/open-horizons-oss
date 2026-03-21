import { supabaseServer } from '../../lib/supabaseServer'
import { DangerZone } from './components/DangerZone'
import { ProfileSettings } from './components/ProfileSettings'

export const dynamic = 'force-dynamic'

export default async function GeneralSettingsPage() {
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
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">General Settings</h2>
        <p className="text-gray-600">Manage your account preferences and application settings.</p>
      </div>

      {/* Profile Section */}
      <ProfileSettings userId={user.id} />


      {/* Notifications Section */}
      <div className="border-t pt-8">
        <div className="border rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Notifications</h3>
          <p className="text-sm text-gray-600 mb-4">
            Configure how and when you receive notifications.
          </p>
          <div className="bg-gray-50 rounded p-3 text-sm text-gray-500">
            Coming soon...
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border-t pt-8">
        <DangerZone userId={user.id} />
      </div>
    </div>
  )
}

