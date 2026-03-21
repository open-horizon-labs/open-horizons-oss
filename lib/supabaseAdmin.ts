import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './supabase/config'

/**
 * Supabase admin client with elevated privileges
 * Bypasses RLS policies - use carefully and only for trusted operations
 */
export function createAdminClient() {
  const config = getSupabaseConfig()

  return createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}