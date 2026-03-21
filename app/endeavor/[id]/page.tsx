import { queryOne } from '../../../lib/db'
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

  const endeavor = await queryOne(
    'SELECT * FROM endeavors WHERE id = $1',
    [id]
  )

  if (!endeavor) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="text-center text-gray-500">
          <h2 className="text-lg font-medium mb-2">Endeavor not found</h2>
          <p>The endeavor could not be found.</p>
          <a href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
            Go to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <EndeavorPageClient
      id={id}
      date={date}
      userId={process.env.DEFAULT_USER_ID || 'default-user'}
      contextId={endeavor.context_id}
    />
  )
}
