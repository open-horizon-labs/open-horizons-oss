/**
 * Standardized API error handling following RFC 7807 Problem Details
 * https://tools.ietf.org/html/rfc7807
 */

export interface ProblemDetails {
  type?: string
  title: string
  status: number
  detail?: string
  instance?: string
  [key: string]: any // Allow additional problem-specific fields
}

export class ApiError extends Error {
  public readonly problem: ProblemDetails

  constructor(
    status: number,
    title: string,
    detail?: string,
    type?: string,
    additional?: Record<string, any>
  ) {
    super(title)
    this.name = 'ApiError'

    this.problem = {
      type: type || 'about:blank',
      title,
      status,
      detail,
      ...additional
    }
  }

  toResponse(): Response {
    return new Response(JSON.stringify(this.problem), {
      status: this.problem.status,
      headers: {
        'Content-Type': 'application/problem+json',
        'Cache-Control': 'no-cache'
      }
    })
  }
}

// Common API errors
export class UnauthorizedError extends ApiError {
  constructor(detail = 'Authentication required') {
    super(401, 'Unauthorized', detail, '/errors/unauthorized')
  }
}

export class ForbiddenError extends ApiError {
  constructor(detail = 'Insufficient permissions') {
    super(403, 'Forbidden', detail, '/errors/forbidden')
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource', detail?: string) {
    super(404, 'Not Found', detail || `${resource} not found`, '/errors/not-found')
  }
}

export class ValidationError extends ApiError {
  constructor(detail: string, errors?: Record<string, string[]>) {
    super(400, 'Validation Failed', detail, '/errors/validation', { errors })
  }
}

export class ConflictError extends ApiError {
  constructor(detail: string) {
    super(409, 'Conflict', detail, '/errors/conflict')
  }
}

export class RateLimitError extends ApiError {
  constructor(limit: number, resetTime: number) {
    super(429, 'Rate Limit Exceeded', 'Too many requests', '/errors/rate-limit', {
      limit,
      resetTime
    })
  }
}

export class InternalServerError extends ApiError {
  constructor(detail = 'An unexpected error occurred') {
    super(500, 'Internal Server Error', detail, '/errors/internal')
  }
}

/**
 * Error handler for API routes
 */
export function handleApiError(error: unknown): Response {
  console.error('API Error:', error)

  if (error instanceof ApiError) {
    return error.toResponse()
  }

  // Handle validation errors from libraries
  if (error instanceof Error && error.message.includes('validation')) {
    return new ValidationError(error.message).toResponse()
  }

  // Handle database constraint errors
  if (error instanceof Error && error.message.includes('duplicate key')) {
    return new ConflictError('Resource already exists').toResponse()
  }

  // Default to internal server error
  return new InternalServerError().toResponse()
}

/**
 * Higher-order function to wrap API routes with error handling
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Validate required fields and throw ValidationError if missing
 */
export function validateRequired(
  data: Record<string, any>,
  fields: string[]
): void {
  const missing = fields.filter(field => !data[field])
  if (missing.length > 0) {
    throw new ValidationError(
      'Required fields are missing',
      { missing: [`Fields ${missing.join(', ')} are required`] }
    )
  }
}

/**
 * Success response helper
 */
export function successResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  })
}