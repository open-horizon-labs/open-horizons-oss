/**
 * Utility functions for generating endeavor links
 */

/**
 * Generate a link to an endeavor detail page
 */
export function getEndeavorLink(endeavorId: string, _date?: string): string {
  return `/endeavor/${encodeURIComponent(endeavorId)}`
}

/**
 * Navigate to an endeavor detail page
 */
export function navigateToEndeavor(endeavorId: string, _date?: string): void {
  window.location.href = getEndeavorLink(endeavorId)
}
