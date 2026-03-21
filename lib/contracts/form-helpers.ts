/**
 * Contract-First Form Helpers
 *
 * These helpers ensure UI forms use the exact same validation as the API.
 * Forms built with these helpers can never send invalid data to APIs.
 */

import {
  CreateEndeavorRequest,
  validateCreateEndeavorRequest,
  UserNodeType,
  ContractViolationError
} from './endeavor-contract'
import { getActiveConfig } from '../config'

/**
 * Get all valid user input node types for form dropdowns.
 *
 * This is now derived from the active strategy configuration.
 * Changing STRATEGY_PRESET changes what appears in dropdowns.
 */
export function getValidNodeTypes(): { value: string; label: string }[] {
  return getActiveConfig().nodeTypes.map(nt => ({
    value: nt.slug,
    label: nt.name
  }))
}

/**
 * Validate form data against create endeavor contract BEFORE sending to API
 *
 * This prevents the form from sending invalid requests that would get 400 errors.
 */
export function validateFormData(formData: {
  title?: string
  type?: string
  contextId?: string | null
  parentId?: string | null
}): CreateEndeavorRequest {
  try {
    return validateCreateEndeavorRequest({
      title: formData.title || '',
      type: formData.type as UserNodeType,
      contextId: formData.contextId || null,
      parentId: formData.parentId || null
    })
  } catch (error) {
    if (error instanceof ContractViolationError) {
      // Transform technical contract errors into user-friendly form errors
      const fieldErrors = error.zodError.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }))

      throw new FormValidationError(fieldErrors)
    }
    throw error
  }
}

/**
 * User-friendly form validation error
 */
export class FormValidationError extends Error {
  constructor(public fieldErrors: Array<{ field: string; message: string }>) {
    super(`Form validation failed: ${fieldErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`)
    this.name = 'FormValidationError'
  }
}

/**
 * Get validation constraints for form fields from the contract
 *
 * This ensures form validation matches API validation exactly.
 */
export function getFieldConstraints() {
  return {
    title: {
      required: true,
      minLength: 1,
      maxLength: 255,
      message: 'Title is required and must be 1-255 characters'
    },
    type: {
      required: true,
      allowedValues: getValidNodeTypes().map(t => t.value),
      message: 'Please select a valid endeavor type'
    },
    contextId: {
      required: false,
      message: 'Context ID must be a string if provided'
    },
    parentId: {
      required: false,
      message: 'Parent ID must be a string if provided'
    }
  }
}

/**
 * Real-time form validation using contracts
 */
export function validateFormFieldsRealtime(formData: {
  title?: string
  type?: string
  contextId?: string | null
  parentId?: string | null
}): Record<string, string> {
  const errors: Record<string, string> = {}

  try {
    validateFormData(formData)
  } catch (error) {
    if (error instanceof FormValidationError) {
      error.fieldErrors.forEach(({ field, message }) => {
        errors[field] = message
      })
    }
  }

  return errors
}

/**
 * Safe API request builder using contracts
 *
 * This ensures the request body exactly matches what the API expects.
 */
export async function submitCreateEndeavor(
  formData: { title: string; type: string; contextId?: string | null; parentId?: string | null }
): Promise<{ success: true; endeavorId: string }> {
  // Validate form data against contract before sending
  const validatedRequest = validateFormData(formData)

  const response = await fetch('/api/endeavors/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedRequest)
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  // Response is guaranteed to match contract since API enforces it
  return await response.json()
}
