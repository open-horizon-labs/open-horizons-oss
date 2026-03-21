import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton admin client for API key operations
let adminClient: SupabaseClient | null = null

/**
 * Get or create the singleton admin Supabase client
 * This client bypasses RLS for API key lookup operations
 */
async function getAdminClient(): Promise<SupabaseClient> {
  if (adminClient) {
    return adminClient
  }

  try {
    const { getSupabaseConfig } = await import('../supabase/config')
    const config = getSupabaseConfig()

    if (!config.url || !config.secretKey) {
      throw new Error('Supabase configuration is incomplete: missing URL or secret key')
    }

    adminClient = createClient(
      config.url,
      config.secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    return adminClient
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[API Keys Service] Failed to initialize admin client:', errorMessage)
    throw new Error(`Failed to initialize Supabase admin client: ${errorMessage}`)
  }
}

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  createdAt: string
  lastUsedAt?: string
  expiresAt?: string
  revokedAt?: string
  revokedReason?: string
  // Enhanced metadata
  permissions: string[]
  environment?: 'development' | 'staging' | 'production'
  description?: string
  usageCount: number
  ipWhitelist?: string[]
  userAgent?: string
}

/**
 * Generate a secure API key with proper prefix and entropy
 */
function generateApiKey(): { fullKey: string; hash: string; prefix: string } {
  // Generate 32 bytes of random data (256 bits)
  const randomBytes = crypto.randomBytes(32)
  const fullKey = `ak_${randomBytes.toString('hex')}`

  // Hash the full key for storage
  const hash = crypto.createHash('sha256').update(fullKey).digest('hex')

  // Extract prefix for display
  const prefix = fullKey.substring(0, 8) // "ak_1234"

  return { fullKey, hash, prefix }
}

/**
 * Hash an API key for comparison
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Create a new API key
 */
export interface CreateApiKeyOptions {
  name: string
  scopes?: string[]
  permissions?: string[]
  expiresAt?: string
  environment?: 'development' | 'staging' | 'production'
  description?: string
  ipWhitelist?: string[]
}

export async function createApiKey(
  userId: string,
  options: CreateApiKeyOptions,
  supabase: SupabaseClient
): Promise<{ success: boolean; apiKey?: ApiKey; fullKey?: string; error?: string }> {

  try {
    const {
      name,
      scopes = ['read'],
      permissions = ['read:profile', 'read:endeavors'],
      expiresAt,
      environment = 'development',
      description,
      ipWhitelist
    } = options

    // Validate name
    if (!name.trim() || name.length > 100) {
      return { success: false, error: 'Name must be 1-100 characters' }
    }

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name.trim())
      .is('revoked_at', null)
      .single()

    if (existing) {
      return { success: false, error: 'An active API key with this name already exists' }
    }

    // Generate key
    const { fullKey, hash, prefix } = generateApiKey()

    // Insert into database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name: name.trim(),
        key_hash: hash,
        key_prefix: prefix,
        scopes,
        expires_at: expiresAt,
        metadata: {
          permissions,
          environment,
          description,
          ipWhitelist,
          usageCount: 0
        }
      })
      .select(`
        id,
        name,
        key_prefix,
        scopes,
        created_at,
        last_used_at,
        expires_at,
        revoked_at,
        revoked_reason,
        metadata
      `)
      .single()

    if (error) {
      console.error('Failed to create API key:', error)
      return { success: false, error: error.message }
    }

    const metadata = data.metadata || {}
    const apiKey: ApiKey = {
      id: data.id,
      name: data.name,
      keyPrefix: data.key_prefix,
      scopes: data.scopes,
      createdAt: data.created_at,
      lastUsedAt: data.last_used_at,
      expiresAt: data.expires_at,
      revokedAt: data.revoked_at,
      revokedReason: data.revoked_reason,
      permissions: metadata.permissions || [],
      environment: metadata.environment,
      description: metadata.description,
      usageCount: metadata.usageCount || 0,
      ipWhitelist: metadata.ipWhitelist,
      userAgent: metadata.userAgent
    }

    return { success: true, apiKey, fullKey }
  } catch (error) {
    console.error('Error creating API key:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create API key'
    }
  }
}

/**
 * List user's API keys
 */
export async function listApiKeys(userId: string, supabase: SupabaseClient): Promise<{ success: boolean; keys?: ApiKey[]; error?: string }> {

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select(`
        id,
        name,
        key_prefix,
        scopes,
        created_at,
        last_used_at,
        expires_at,
        revoked_at,
        revoked_reason,
        metadata
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to list API keys:', error)
      return { success: false, error: error.message }
    }

    const keys: ApiKey[] = (data || []).map(row => {
      const metadata = row.metadata || {}
      return {
        id: row.id,
        name: row.name,
        keyPrefix: row.key_prefix,
        scopes: row.scopes,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        revokedReason: row.revoked_reason,
        permissions: metadata.permissions || [],
        environment: metadata.environment,
        description: metadata.description,
        usageCount: metadata.usageCount || 0,
        ipWhitelist: metadata.ipWhitelist,
        userAgent: metadata.userAgent
      }
    })

    return { success: true, keys }
  } catch (error) {
    console.error('Error listing API keys:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list API keys'
    }
  }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  userId: string,
  keyId: string,
  reason?: string,
  supabase?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  // Use provided supabase client or create service client for API key operations
  if (!supabase) {
    const { getSupabaseConfig } = await import('../supabase/config')
    const config = getSupabaseConfig()

    supabase = createClient(
      config.url,
      config.secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }

  try {
    const { error } = await supabase
      .from('api_keys')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: reason || 'Revoked by user'
      })
      .eq('id', keyId)
      .eq('user_id', userId)
      .is('revoked_at', null) // Only revoke if not already revoked

    if (error) {
      console.error('Failed to revoke API key:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error revoking API key:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke API key'
    }
  }
}

/**
 * Authenticate API key and return user ID
 */
export async function authenticateApiKey(key: string): Promise<{ userId?: string; keyId?: string; error?: string }> {
  if (!key || !key.startsWith('ak_')) {
    return { error: 'Invalid API key format' }
  }

  // Use singleton admin client to bypass RLS for API key lookup
  const supabase = await getAdminClient()
  const hash = hashApiKey(key)

  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, user_id')
      .eq('key_hash', hash)
      .is('revoked_at', null)
      .single()

    if (error || !data) {
      return { error: 'Invalid or expired API key' }
    }

    // Update last used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)

    return { userId: data.user_id, keyId: data.id }
  } catch (error) {
    console.error('Error authenticating API key:', error)
    return { error: 'Authentication failed' }
  }
}