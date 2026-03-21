/**
 * Unit tests for endeavor contract validators
 *
 * These are fast, pure function tests with no external dependencies.
 */

import { describe, it, expect } from '@jest/globals'
import {
  validateArchiveRequest,
  validateUpdateTitleRequest,
  validateSuccessResponse,
  ContractViolationError
} from '../../lib/contracts/endeavor-contract'

describe('validateArchiveRequest', () => {
  it('should accept empty object (reason is optional)', () => {
    const result = validateArchiveRequest({})
    expect(result).toEqual({})
  })

  it('should accept valid reason string', () => {
    const result = validateArchiveRequest({ reason: 'No longer needed' })
    expect(result.reason).toBe('No longer needed')
  })

  it('should accept undefined reason', () => {
    const result = validateArchiveRequest({ reason: undefined })
    expect(result).toEqual({ reason: undefined })
  })

  it('should reject reason longer than 500 characters', () => {
    const longReason = 'x'.repeat(501)
    expect(() => validateArchiveRequest({ reason: longReason }))
      .toThrow(ContractViolationError)
  })

  it('should reject non-string reason', () => {
    expect(() => validateArchiveRequest({ reason: 123 }))
      .toThrow(ContractViolationError)
  })
})

describe('validateUpdateTitleRequest', () => {
  it('should accept valid title', () => {
    const result = validateUpdateTitleRequest({ title: 'New Title' })
    expect(result.title).toBe('New Title')
  })

  it('should reject empty title', () => {
    expect(() => validateUpdateTitleRequest({ title: '' }))
      .toThrow(ContractViolationError)
  })

  it('should reject missing title', () => {
    expect(() => validateUpdateTitleRequest({}))
      .toThrow(ContractViolationError)
  })

  it('should reject title longer than 255 characters', () => {
    const longTitle = 'x'.repeat(256)
    expect(() => validateUpdateTitleRequest({ title: longTitle }))
      .toThrow(ContractViolationError)
  })

  it('should accept title exactly 255 characters', () => {
    const maxTitle = 'x'.repeat(255)
    const result = validateUpdateTitleRequest({ title: maxTitle })
    expect(result.title).toBe(maxTitle)
  })

  it('should reject non-string title', () => {
    expect(() => validateUpdateTitleRequest({ title: 123 }))
      .toThrow(ContractViolationError)
  })
})

describe('validateSuccessResponse', () => {
  it('should accept success: true without message', () => {
    const result = validateSuccessResponse({ success: true })
    expect(result.success).toBe(true)
    expect(result.message).toBeUndefined()
  })

  it('should accept success: true with message', () => {
    const result = validateSuccessResponse({ success: true, message: 'Done!' })
    expect(result.success).toBe(true)
    expect(result.message).toBe('Done!')
  })

  it('should reject success: false', () => {
    expect(() => validateSuccessResponse({ success: false }))
      .toThrow(ContractViolationError)
  })

  it('should reject missing success field', () => {
    expect(() => validateSuccessResponse({}))
      .toThrow(ContractViolationError)
  })

  it('should reject non-boolean success', () => {
    expect(() => validateSuccessResponse({ success: 'true' }))
      .toThrow(ContractViolationError)
  })
})

describe('ContractViolationError', () => {
  it('should include contract name in error', () => {
    try {
      validateUpdateTitleRequest({ title: '' })
    } catch (error) {
      expect(error).toBeInstanceOf(ContractViolationError)
      expect((error as ContractViolationError).contractName).toBe('UpdateTitleRequest')
    }
  })

  it('should include layer in error', () => {
    try {
      validateSuccessResponse({ success: false })
    } catch (error) {
      expect(error).toBeInstanceOf(ContractViolationError)
      expect((error as ContractViolationError).layer).toBe('response')
    }
  })

  it('should include zodError with issues', () => {
    try {
      validateArchiveRequest({ reason: 123 })
    } catch (error) {
      expect(error).toBeInstanceOf(ContractViolationError)
      expect((error as ContractViolationError).zodError.issues.length).toBeGreaterThan(0)
    }
  })
})
