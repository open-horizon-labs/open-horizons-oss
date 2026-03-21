/**
 * API authentication utilities -- simplified for standalone Postgres
 * No auth ceremony: all requests get a default user identity.
 */

import { NextRequest } from 'next/server'
import { handleApiError } from './api/errors'

export interface AuthenticatedUser {
  id: string
  email: string
}

/**
 * Get the default user. In the future this could read from a config or header.
 */
function getDefaultUser(): AuthenticatedUser {
  return {
    id: process.env.DEFAULT_USER_ID || 'default-user',
    email: process.env.DEFAULT_USER_EMAIL || 'user@localhost',
  }
}

/**
 * Higher-order function to wrap API routes with authentication.
 * Currently a pass-through that always provides a default user.
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key', ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const user = getDefaultUser()
      return await handler(request, user, 'session', ...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Simplified withAuth for routes that don't need authMethod parameter
 */
export function withSimpleAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<Response>
) {
  return withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key', ...args: T) => {
    return handler(request, user, ...args)
  })
}

/**
 * Auth wrapper for routes with dynamic params
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

/**
 * Authenticate a request -- always returns the default user.
 */
export async function authenticateRequest(request: NextRequest) {
  return {
    user: getDefaultUser(),
    authMethod: 'session' as const
  }
}
