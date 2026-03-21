import { DailyLogPageClient } from './DailyLogPageClient'
import { supabaseServer } from '../../../lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function DailyLogPage({
  params,
  searchParams
}: {
  params: Promise<{ date: string }>
  searchParams: Promise<{ context?: string }>
}) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Please sign in</div>
  }

  return <DailyLogPageClient params={params} searchParams={searchParams} userId={user.id} />
}