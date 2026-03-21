import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { createApiKey, listApiKeys, CreateApiKeyOptions } from '../../../lib/api-keys/service'
import { ValidationError, successResponse, handleApiError, validateRequired } from '../../../lib/api/errors'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const result = await listApiKeys(user.id, supabase)
    if (!result.success) {
      throw new Error(result.error)
    }

    return successResponse({ keys: result.keys })
  } catch (error) {
    return handleApiError(error)
  }
})

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const body = await request.json()
    validateRequired(body, ['name'])

    const options: CreateApiKeyOptions = {
      name: body.name,
      scopes: body.scopes,
      permissions: body.permissions,
      expiresAt: body.expiresAt,
      environment: body.environment,
      description: body.description,
      ipWhitelist: body.ipWhitelist
    }

    const result = await createApiKey(user.id, options, supabase)
    if (!result.success) {
      throw new ValidationError(result.error || 'Failed to create API key')
    }

    // Return the API key object and the full key (only time it's shown)
    return successResponse({
      apiKey: result.apiKey,
      key: result.fullKey
    }, 201)
  } catch (error) {
    return handleApiError(error)
  }
})