/**
 * Utility functions for generating endeavor links
 */

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Generate a link to an endeavor for a specific date
 * If the date is today, omit the /daily/[date] suffix for cleaner URLs
 * Context is NOT included in URLs - server resolves from endeavor's context_id
 */
export function getEndeavorLink(endeavorId: string, date: string): string {
  const today = getTodayString()
  const encodedId = encodeURIComponent(endeavorId)

  if (date === today) {
    return `/endeavors/${encodedId}`
  } else {
    return `/endeavors/${encodedId}/daily/${date}`
  }
}

/**
 * Navigate to an endeavor for a specific date
 * If the date is today, omit the /daily/[date] suffix for cleaner URLs
 * Context is NOT included in URLs - server resolves from endeavor's context_id
 */
export function navigateToEndeavor(endeavorId: string, date: string): void {
  window.location.href = getEndeavorLink(endeavorId, date)
}
