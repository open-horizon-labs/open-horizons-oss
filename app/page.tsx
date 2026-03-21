import { redirect } from 'next/navigation'
import { supabaseServer } from '../lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}