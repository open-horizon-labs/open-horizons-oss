/**
 * API authentication utilities
 * Handles both session and API key authentication for API routes
 */

import { NextRequest } from 'next/server'
import { getUserFromSession } from './auth'
import { authenticateApiKey } from './api-keys/service'
import { UnauthorizedError, handleApiError } from './api/errors'

export interface AuthenticatedUser {
  id: string
  email: string
  created_at: string
  updated_at: string
}

export interface AuthResult {
  user: AuthenticatedUser | null
  error?: string
  authMethod?: 'session' | 'api_key'
}

/**
 * Authenticate a request using either session cookies or API key
 * This allows the same API endpoints to work with both web sessions and API keys
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // First try API key authentication
  const authHeader = request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix

    if (apiKey.startsWith('ak_')) {
      // This is an API key
      const result = await authenticateApiKey(apiKey)
      if (result.userId) {
        // For API key auth, we need to get user details from the database
        const user = await getUserById(result.userId)
        if (user) {
          return {
            user,
            authMethod: 'api_key'
          }
        }
      }

      return {
        user: null,
        error: result.error || 'Invalid API key',
        authMethod: 'api_key'
      }
    }
  }

  // Fall back to session authentication
  try {
    const user = await getUserFromSession()
    if (user) {
      return {
        user: user as AuthenticatedUser,
        authMethod: 'session'
      }
    }
  } catch (error) {
    console.error('Session authentication error:', error)
    // Check if this is a connection error to Supabase (development only)
    if (process.env.NODE_ENV === 'development' && error && typeof error === 'object' && 'cause' in error) {
      const cause = (error as any).cause
      if (cause && cause.code === 'ECONNREFUSED' && cause.port === 54321) {
        return {
          user: null,
          error: '🚨 DEV ERROR: Supabase local instance not running! Run `npx supabase start` or start Docker Desktop'
        }
      }
    }
  }

  return {
    user: null,
    error: 'Authentication required'
  }
}

/**
 * Get user by ID (for API key authentication)
 */
async function getUserById(userId: string): Promise<AuthenticatedUser | null> {
  // Import here to avoid circular dependencies
  const { createClient } = await import('@supabase/supabase-js')
  const { getSupabaseConfig } = await import('./supabase/config')

  const config = getSupabaseConfig()

  // Use admin client for user lookup
  const supabase = createClient(
    config.url,
    config.secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId)

    if (error || !data.user) {
      return null
    }

    return {
      id: data.user.id,
      email: data.user.email!,
      created_at: data.user.created_at,
      updated_at: data.user.updated_at || data.user.created_at
    }
  } catch (error) {
    console.error('Error getting user by ID:', error)
    return null
  }
}

/**
 * Higher-order function to wrap API routes with authentication
 * Supports both session and API key authentication automatically
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key', ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const authResult = await authenticateRequest(request)

      if (!authResult.user) {
        throw new UnauthorizedError(authResult.error || 'Authentication required')
      }

      return await handler(request, authResult.user, authResult.authMethod || 'session', ...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Simplified withAuth for routes that don't need authMethod parameter
 * Most common use case
 */
export function withSimpleAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<Response>
) {
  return withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key', ...args: T) => {
    return handler(request, user, ...args)
  })
}

/**
 * Auth wrapper for routes with dynamic params (most common pattern)
 */
export function withParamsAuth<P extends Record<string, string>>(
  handler: (request: NextRequest, user: AuthenticatedUser, params: P) => Promise<Response>
) {
  return withAuth(async (
    request: NextRequest,
    user: AuthenticatedUser,
    authMethod: 'session' | 'api_key',
    context: { params: Promise<P> }
  ) => {
    const params = await context.params
    return handler(request, user, params)
  })
}
