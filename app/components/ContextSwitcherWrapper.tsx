import { supabaseServer } from '../../lib/supabaseServer'
import ContextSwitcher from './ContextSwitcher'

export async function ContextSwitcherWrapper() {
  const supabase = await supabaseServer()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  return <ContextSwitcher currentUserId={user.id} />
}

export default ContextSwitcherWrapper