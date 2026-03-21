import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}

/**
 * Legacy route - redirects to new /endeavor/[id] URL format
 * Kept for backward compatibility with existing bookmarks and links
 */
export default async function LegacyEndeavorPage({ params, searchParams }: Props) {
  const { id: rawId } = await params
  const { date } = await searchParams
  const id = decodeURIComponent(rawId)

  // Redirect to new clean URL format
  const newUrl = date ? `/endeavor/${encodeURIComponent(id)}?date=${date}` : `/endeavor/${encodeURIComponent(id)}`
  redirect(newUrl)
}