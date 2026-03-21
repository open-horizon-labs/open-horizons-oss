/**
 * Test setup utility
 */

export function validateEnvironment(): void {
  const requiredEnvVars = [
    'DATABASE_URL'
  ]

  const missing = requiredEnvVars.filter(varName => !process.env[varName])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  console.log('Environment variables validated')
}