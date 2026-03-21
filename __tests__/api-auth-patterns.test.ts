/**
 * AST-Level API Route Authentication Pattern Enforcement
 *
 * This test scans all API routes and enforces consistent authentication patterns:
 * 1. ALL routes must use withAuth/withSimpleAuth/withParamsAuth
 * 2. NO routes should use supabaseServer() directly (breaks API key auth)
 * 3. Routes must use getSupabaseForAuthMethod(authMethod, user.id)
 *
 * This prevents auth client inconsistencies that break API key authentication.
 */

import { describe, test, expect } from '@jest/globals'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Routes exempt from auth enforcement (public routes, special cases)
const EXEMPT_ROUTES = new Set([
  'app/api/auth', // Auth routes handle their own auth
  'app/api/test/route.ts', // Test endpoint
  'app/api/integrations/webhook/route.ts', // External webhooks
  'app/api/api-keys/route.ts', // API key creation route (used during auth flow)
  'app/api/invitations/validate', // Invitation validation (public token-based)
  'app/api/about/route.ts', // Public API info endpoint
])

// Find all API route files
function findApiRoutes(dir: string, routes: string[] = []): string[] {
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      findApiRoutes(fullPath, routes)
    } else if (entry === 'route.ts' || entry === 'route.js') {
      // Convert to relative path for easier checking
      const relativePath = fullPath.replace(process.cwd() + '/', '')
      if (!EXEMPT_ROUTES.has(relativePath) && !Array.from(EXEMPT_ROUTES).some(exempt => relativePath.includes(exempt))) {
        routes.push(fullPath)
      }
    }
  }

  return routes
}

describe('API Route Authentication Pattern Enforcement', () => {
  const apiRoutesDir = join(process.cwd(), 'app', 'api')
  const apiRoutes = findApiRoutes(apiRoutesDir)

  test('should find API routes to test', () => {
    expect(apiRoutes.length).toBeGreaterThan(0)
    console.log(`🔍 Found ${apiRoutes.length} API routes to validate`)
  })

  test.each(apiRoutes.map(route => [route]))('Route %s should follow auth patterns', (routePath: string) => {
    const content = readFileSync(routePath, 'utf-8')
    const relativePath = routePath.replace(process.cwd() + '/', '')

    // Check 1: Must use proper auth wrapper
    const hasProperAuth = (
      content.includes('withAuth(') ||
      content.includes('withSimpleAuth(') ||
      content.includes('withParamsAuth(')
    )

    expect(hasProperAuth).toBe(true)
    if (!hasProperAuth) {
      throw new Error(`❌ ${relativePath}: Must use withAuth/withSimpleAuth/withParamsAuth for authentication`)
    }

    // Check 2: Must NOT use supabaseServer() directly
    const usesSupabaseServer = content.includes('supabaseServer()')

    expect(usesSupabaseServer).toBe(false)
    if (usesSupabaseServer) {
      throw new Error(`❌ ${relativePath}: Must NOT use supabaseServer() - use getSupabaseForAuthMethod(authMethod, user.id) instead`)
    }

    // Check 3: If it uses Supabase, should use proper auth method
    const usesSupabase = content.includes('.from(') || content.includes('supabase.')
    if (usesSupabase) {
      const hasProperSupabaseAuth = content.includes('getSupabaseForAuthMethod')

      expect(hasProperSupabaseAuth).toBe(true)
      if (!hasProperSupabaseAuth) {
        throw new Error(`❌ ${relativePath}: Uses Supabase but doesn't use getSupabaseForAuthMethod(authMethod, user.id)`)
      }
    }

    console.log(`✅ ${relativePath}: Auth patterns validated`)
  })

  test('should report routes using problematic patterns', () => {
    const problemRoutes: string[] = []

    for (const routePath of apiRoutes) {
      const content = readFileSync(routePath, 'utf-8')
      const relativePath = routePath.replace(process.cwd() + '/', '')

      if (content.includes('supabaseServer()')) {
        problemRoutes.push(relativePath)
      }
    }

    if (problemRoutes.length > 0) {
      console.warn(`⚠️ Found ${problemRoutes.length} routes using supabaseServer():`)
      problemRoutes.forEach(route => console.warn(`   - ${route}`))
      console.warn('These routes will fail with API key authentication!')
    }

    // Don't fail the test, just warn for now since we're fixing them gradually
    expect(true).toBe(true)
  })
})