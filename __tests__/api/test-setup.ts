/**
 * Test setup utility to ensure test users and API keys exist
 */

import { spawn } from 'child_process'
import { join } from 'path'

export async function ensureTestUsersExist(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('🔧 Setting up test users and API keys...')

    const setupScript = join(__dirname, '../../scripts/setup-test-users.js')
    const setupProcess = spawn('node', [setupScript], {
      stdio: 'inherit',
      cwd: join(__dirname, '../..')
    })

    setupProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Test users setup complete')
        resolve()
      } else {
        reject(new Error(`Test users setup failed with exit code ${code}`))
      }
    })

    setupProcess.on('error', (error) => {
      reject(error)
    })
  })
}

export function validateEnvironment(): void {
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SECRET_KEY'
  ]

  const missing = requiredEnvVars.filter(varName => !process.env[varName])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  console.log('✅ Environment variables validated')
}