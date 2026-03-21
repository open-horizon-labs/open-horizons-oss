import { supabaseServer } from './supabaseServer'

export async function getUserFromSession() {
  const supabase = await supabaseServer()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  return user
}