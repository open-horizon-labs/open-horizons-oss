import { DashboardPageClient } from '../components/DashboardPageClient'

export const dynamic = 'force-dynamic'

export default function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ deleted?: string; archived?: string; context?: string }>
}) {
  return <DashboardPageClient searchParams={searchParams} />
}
