/**
 * Create appropriate Supabase client based on authentication method
 * Uses ES256 (ECDSA P-256) for JWT signing - compatible with Supabase's rotating key system
 */

import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from './supabaseServer'
import { getSupabaseConfig } from './supabase/config'
import { SignJWT, importJWK } from 'jose'

export async function getSupabaseForAuthMethod(authMethod: 'session' | 'api_key', userId?: string) {
  if (authMethod === 'session') {
    // For session auth, use the regular server client that handles cookies
    return await supabaseServer()
  }

  if (!userId) {
    throw new Error('User ID is required for API key authentication')
  }

  // getSupabaseConfig() validates the ES256 JWK signing key
  let config
  try {
    config = getSupabaseConfig()

    // Validate returned config has required properties
    if (!config || typeof config !== 'object') {
      throw new Error('getSupabaseConfig() returned invalid config object')
    }
    if (!config.url || typeof config.url !== 'string') {
      throw new Error('Config missing required property: url')
    }
    if (!config.publicKey || typeof config.publicKey !== 'string') {
      throw new Error('Config missing required property: publicKey')
    }
    if (!config.signingKey || typeof config.signingKey !== 'object') {
      throw new Error(
        'Config missing required property: signingKey. ' +
        'SUPABASE_JWT_SIGNING_KEY must be set for API key authentication. ' +
        'Generate with: npx supabase gen signing-key --algorithm ES256'
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to load Supabase config for API key authentication: ${errorMessage}`)
  }

  // Import the JWK as a crypto key for signing
  // Strip key_ops to only 'sign' to avoid jose 6.x validation issues
  const signingKeyForImport = {
    ...config.signingKey,
    key_ops: ['sign']
  }
  const privateKey = await importJWK(signingKeyForImport, 'ES256')

  // Create JWT for user authentication using ES256
  // This enables RLS policies to work with API key authentication
  const token = await new SignJWT({
    sub: userId,
    role: 'authenticated',
    aud: 'authenticated'
  })
    .setProtectedHeader({
      alg: 'ES256',
      kid: config.signingKey.kid,
      typ: 'JWT'
    })
    .setIssuer(`${config.url}/auth/v1`)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)

  // Create client with the user's JWT token for RLS enforcement
  return createClient(
    config.url,
    config.publicKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  )
}