"use client"
import { createBrowserClient } from '@supabase/ssr'

/**
 * Get client-safe Supabase configuration
 * Only uses NEXT_PUBLIC_* environment variables safe for browser exposure
 */
function getClientSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url) {
    throw new Error(
      'Supabase configuration error: NEXT_PUBLIC_SUPABASE_URL is not set. ' +
      'Please check your .env.local file and ensure this environment variable is defined.'
    )
  }

  if (!publishableKey) {
    throw new Error(
      'Supabase configuration error: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set. ' +
      'Please check your .env.local file and ensure this environment variable is defined.'
    )
  }

  // Validate URL format
  try {
    new URL(url)
  } catch {
    throw new Error(
      `Supabase configuration error: NEXT_PUBLIC_SUPABASE_URL is malformed: "${url}". ` +
      'Expected format: https://xxxxx.supabase.co'
    )
  }

  // Basic validation for publishable key format
  // Only accept new Supabase key format (sb_publishable_...)
  if (!publishableKey.startsWith('sb_')) {
    throw new Error(
      'Supabase configuration error: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY appears malformed. ' +
      'Expected a key starting with "sb_" (e.g., sb_publishable_...).'
    )
  }

  return { url, publishableKey }
}

// Singleton client instance - initialized lazily
let cachedClient: ReturnType<typeof createBrowserClient> | null = null

export const supabaseClient = () => {
  // Only initialize client in browser environment
  if (typeof window === 'undefined') {
    throw new Error('supabaseClient can only be called in browser environment')
  }

  // Return cached client if already initialized
  if (cachedClient) {
    return cachedClient
  }

  // Initialize client once
  const config = getClientSupabaseConfig()
  cachedClient = createBrowserClient(
    config.url,
    config.publishableKey
  )

  return cachedClient
}

