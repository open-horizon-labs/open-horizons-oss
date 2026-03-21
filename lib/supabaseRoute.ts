import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseConfig } from './supabase/config'

/**
 * Create a Supabase client for use in API route handlers
 * This is compatible with Next.js 15's async cookies API
 */
export async function createRouteClient() {
  const cookieStore = await cookies()
  const config = getSupabaseConfig()

  return createServerClient(
    config.url,
    config.publicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}