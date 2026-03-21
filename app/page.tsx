import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // No auth -- always redirect to dashboard
  redirect('/dashboard')
}
