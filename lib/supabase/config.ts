/**
 * Supabase configuration management
 * Uses ES256 asymmetric JWT signing (ECDSA with SHA-256, NIST P-256 curve)
 * Compatible with Supabase's rotating key system and SOC2 compliance
 *
 * 🚨 SERVER-SIDE ONLY MODULE: Build-time enforcement via server-only package
 */

// Build-time enforcement: This import will cause build failures if this module is imported in client code
import 'server-only'

/**
 * JWK (JSON Web Key) structure for ES256 signing
 * Generated with: npx supabase gen signing-key --algorithm ES256
 *
 * Per RFC 7518 Section 3.4: ECDSA using P-256 and SHA-256
 */
export interface JWKSigningKey {
  kty: 'EC'
  kid: string        // Key ID - must match when importing to Supabase
  use: 'sig'
  key_ops: string[]
  alg: 'ES256'
  ext: boolean
  d: string          // Private key component (for signing) - KEEP SECRET
  crv: 'P-256'
  x: string          // Public key X coordinate
  y: string          // Public key Y coordinate
}

export interface SupabaseConfig {
  url: string
  publicKey: string           // publishable_key
  secretKey: string           // secret_key (service role)
  signingKey?: JWKSigningKey  // ES256 JWK for API key authentication (optional for admin-only ops)
}

/**
 * Get Supabase configuration
 *
 * 🚨 SERVER-SIDE ONLY: Never call from client code (exposes secrets)
 */
export function getSupabaseConfig(): SupabaseConfig {
  // Runtime guard: this should only run server-side
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseConfig() must only be called server-side')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
  const signingKeyJson = process.env.SUPABASE_JWT_SIGNING_KEY?.trim()

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

  if (!secretKey) {
    throw new Error(
      'Supabase configuration error: SUPABASE_SECRET_KEY is not set. ' +
      'This is required for server-side operations. ' +
      'Please check your .env.local file and ensure this environment variable is defined.'
    )
  }

  // Parse and validate the JWK signing key (optional - only needed for API key auth)
  let signingKey: JWKSigningKey | undefined
  if (signingKeyJson) {
    let parsedKey: JWKSigningKey
    try {
      parsedKey = JSON.parse(signingKeyJson)
    } catch {
      throw new Error(
        'Supabase configuration error: SUPABASE_JWT_SIGNING_KEY is not valid JSON. ' +
        'It should be the full JWK object from: npx supabase gen signing-key --algorithm ES256'
      )
    }

    // Validate required JWK properties for ES256
    if (parsedKey.kty !== 'EC' || parsedKey.alg !== 'ES256' || parsedKey.crv !== 'P-256') {
      throw new Error(
        'Supabase configuration error: SUPABASE_JWT_SIGNING_KEY must be an ES256 EC key (P-256 curve). ' +
        'Generate with: npx supabase gen signing-key --algorithm ES256'
      )
    }

    if (!parsedKey.kid || !parsedKey.d || !parsedKey.x || !parsedKey.y) {
      throw new Error(
        'Supabase configuration error: SUPABASE_JWT_SIGNING_KEY is missing required fields (kid, d, x, y). ' +
        'Ensure you copied the complete JWK output including the private key component.'
      )
    }

    signingKey = parsedKey
  }

  return {
    url,
    publicKey: publishableKey,
    secretKey,
    signingKey
  }
}

