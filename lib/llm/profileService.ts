import { SupabaseClient } from '@supabase/supabase-js'
import { UserProfile } from './contextBuilder'

/**
 * Fetches user profile data for LLM context using a Supabase client
 * @param supabase - The Supabase client instance
 * @param userId - The user ID to fetch profile for
 * @returns UserProfile object or null if not found
 */
export async function fetchUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('about_me, llm_personalization')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error)
      return null
    }

    return profile || null
  } catch (error) {
    console.error('Error in fetchUserProfile:', error)
    return null
  }
}