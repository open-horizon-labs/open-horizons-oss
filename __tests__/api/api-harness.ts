/**
 * API Test Harness
 * Manages starting/stopping the Next.js app for real API testing
 */

import { spawn, ChildProcess } from 'child_process'
import { setTimeout as delay } from 'timers/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFileSync, readFileSync, existsSync } from 'fs'

// Create a wrapper for fetch that ensures proper response structure
async function httpFetch(url: string, options?: any): Promise<any> {
  // Use globalThis.fetch if available, otherwise require node-fetch v2
  const fetchImpl = globalThis.fetch || (await import('node-fetch')).default

  const response = await fetchImpl(url, options)

  // Ensure the response has all the properties we need
  return {
    ok: response.ok,
    status: response.status || (response.ok ? 200 : 500),
    statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
    headers: response.headers,
    json: () => response.json(),
    text: () => response.text(),
  }
}

const realFetch = httpFetch

export interface TestHarnessConfig {
  port: number
  timeout: number
  retries: number
  retryDelay: number
}

export class ApiTestHarness {
  private appProcess: ChildProcess | null = null
  private config: TestHarnessConfig

  constructor(config: Partial<TestHarnessConfig> = {}) {
    this.config = {
      port: this.findAvailablePort(),
      timeout: 10000, // 10 seconds
      retries: 30,
      retryDelay: 300, // 300ms
      ...config
    }

    // If TEST_API_BASE_URL is provided, extract port from it
    if (process.env.TEST_API_BASE_URL) {
      const url = new URL(process.env.TEST_API_BASE_URL)
      const port = parseInt(url.port)
      if (port && port > 0) {
        console.log(`🔗 Using external test API at ${process.env.TEST_API_BASE_URL}`)
        this.config.port = port
      }
    }
  }

  /**
   * Find an available port, preferring stored port or falling back to range scan
   */
  private findAvailablePort(): number {
    const portFile = join(process.cwd(), '.api-test.port')

    // Try to read stored port first
    if (existsSync(portFile)) {
      try {
        const storedPort = parseInt(readFileSync(portFile, 'utf8').trim())
        if (storedPort >= 3003 && storedPort <= 3020) {
          console.log(`📋 Using stored test port: ${storedPort}`)
          return storedPort
        }
      } catch (error) {
        // Invalid port file, continue to scan
      }
    }

    // Scan for available port in range 3003-3020
    for (let port = 3003; port <= 3020; port++) {
      if (!this.isPortInUseSync(port)) {
        console.log(`🔍 Found available test port: ${port}`)
        // Store the port for future use
        writeFileSync(portFile, port.toString())
        return port
      }
    }

    // Fallback to 3003 if nothing available (will handle conflict later)
    console.log('⚠️ No available ports found in range 3003-3020, using 3003')
    return 3003
  }

  /**
   * Synchronous port check (faster for scanning)
   */
  private isPortInUseSync(port: number): boolean {
    try {
      const { execSync } = require('child_process')
      const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: 'pipe' })
      return result.trim().length > 0
    } catch (error) {
      // lsof returns non-zero exit code when port is free
      return false
    }
  }

  /**
   * Validate that API keys actually work against the running app
   * This detects stale keys from database resets
   */
  private async validateApiKeys(): Promise<boolean> {
    if (!process.env.TEST_API_KEY_1 || !process.env.TEST_API_KEY_2) {
      return false
    }

    try {
      // Only log validation in verbose mode or when there are issues

      // Test both keys against a lightweight endpoint
      const [response1, response2] = await Promise.all([
        realFetch(`${this.getBaseUrl()}/api/auth/user`, {
          headers: {
            'Authorization': `Bearer ${process.env.TEST_API_KEY_1}`,
            'Content-Type': 'application/json'
          }
        }),
        realFetch(`${this.getBaseUrl()}/api/auth/user`, {
          headers: {
            'Authorization': `Bearer ${process.env.TEST_API_KEY_2}`,
            'Content-Type': 'application/json'
          }
        })
      ])

      const key1Valid = response1.ok
      const key2Valid = response2.ok

      if (key1Valid && key2Valid) {
        return true
      } else {
        console.log(`⚠️ API key validation failed: KEY1=${key1Valid ? 'valid' : 'invalid'}, KEY2=${key2Valid ? 'valid' : 'invalid'}`)
        return false
      }
    } catch (error) {
      console.log(`⚠️ API key validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }

  /**
   * Validate API keys and recreate them if stale or missing
   * This handles database resets that invalidate existing keys
   */
  private async validateAndRecreateApiKeysIfNeeded(): Promise<void> {
    const keysValid = await this.validateApiKeys()

    if (!keysValid) {
      console.log('🔧 API keys are invalid or missing, recreating test users...')

      // Force recreation by calling the setup script directly
      await this.recreateTestUsers()

      // Force reload environment variables after recreation
      const dotenv = require('dotenv')
      const envPath = join(process.cwd(), '.env.local')
      const envVars = dotenv.parse(require('fs').readFileSync(envPath, 'utf8'))

      // Update process.env with new values
      process.env.TEST_API_KEY_1 = envVars.TEST_API_KEY_1
      process.env.TEST_API_KEY_2 = envVars.TEST_API_KEY_2

      // Environment variables reloaded silently

      // Validate again to ensure recreation worked
      const keysValidAfterRecreation = await this.validateApiKeys()
      if (!keysValidAfterRecreation) {
        throw new Error('Failed to recreate valid API keys. Test setup may be broken.')
      }
    }
  }

  /**
   * Force recreation of test users and API keys
   * This bypasses the environment check and always runs setup
   */
  private async recreateTestUsers(): Promise<void> {
    console.log('🛠️  Force recreating test users and API keys...')

    return new Promise((resolve, reject) => {
      const setupProcess = spawn('node', ['scripts/setup-test-users.js'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      let errorOutput = ''

      setupProcess.stdout?.on('data', (data) => {
        const text = data.toString()
        output += text
        // Only log important setup messages, not verbose details
        if (text.includes('✅') || text.includes('Setting up') || text.includes('Created')) {
          console.log(`[SETUP] ${text.trim()}`)
        }
      })

      setupProcess.stderr?.on('data', (data) => {
        const text = data.toString()
        errorOutput += text
        console.error(`[SETUP ERROR] ${text.trim()}`)
      })

      setupProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Test users recreation completed')
          resolve()
        } else {
          reject(new Error(`Setup script failed with code ${code}. Output: ${output}. Error: ${errorOutput}`))
        }
      })

      setupProcess.on('error', (error) => {
        reject(new Error(`Failed to run setup script: ${error.message}`))
      })
    })
  }

  /**
   * Ensure test users and API keys exist and are valid
   * This makes the test suite self-contained and robust against database resets
   */
  async ensureTestUsersExist(): Promise<void> {
    console.log('🔍 Checking if test users exist...')

    // First check if we have API keys in environment
    if (process.env.TEST_API_KEY_1 && process.env.TEST_API_KEY_2) {
      console.log('📋 Found API keys in environment, will validate after app starts')
      return
    }

    console.log('🛠️  Setting up test users and API keys...')

    return new Promise((resolve, reject) => {
      const setupProcess = spawn('node', ['scripts/setup-test-users.js'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let output = ''
      let errorOutput = ''

      setupProcess.stdout?.on('data', (data) => {
        const text = data.toString()
        output += text
        // Only log important setup messages, not verbose details
        if (text.includes('✅') || text.includes('Setting up') || text.includes('Created')) {
          console.log(`[SETUP] ${text.trim()}`)
        }
      })

      setupProcess.stderr?.on('data', (data) => {
        const text = data.toString()
        errorOutput += text
        console.error(`[SETUP ERROR] ${text.trim()}`)
      })

      setupProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Test users setup completed')
          // Reload environment variables
          require('dotenv').config({ path: join(process.cwd(), '.env.local') })
          resolve()
        } else {
          reject(new Error(`Setup script failed with code ${code}. Output: ${output}. Error: ${errorOutput}`))
        }
      })

      setupProcess.on('error', (error) => {
        reject(new Error(`Failed to run setup script: ${error.message}`))
      })
    })
  }

  /**
   * Check if a port is already in use
   */
  private async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const { spawn } = require('child_process')
      const lsof = spawn('lsof', ['-ti', `:${port}`])

      let hasOutput = false
      lsof.stdout.on('data', () => {
        hasOutput = true
      })

      lsof.on('close', () => {
        resolve(hasOutput)
      })

      lsof.on('error', () => {
        resolve(false)
      })
    })
  }

  /**
   * Start the Next.js app on the configured port
   */
  async startApp(): Promise<void> {
    // Check if port is already in use
    const portInUse = await this.isPortInUse(this.config.port)
    if (portInUse) {
      console.log(`🔌 Port ${this.config.port} already in use - using existing instance`)
      // Ensure test users exist but don't start a new app
      await this.ensureTestUsersExist()
      return Promise.resolve()
    }

    // Ensure test users exist before starting the app
    await this.ensureTestUsersExist()

    console.log(`🚀 Starting Next.js app on port ${this.config.port}`)

    return new Promise((resolve, reject) => {
      // Start the Next.js app
      this.appProcess = spawn('npx', ['next', 'dev', '-p', this.config.port.toString()], {
        env: {
          ...process.env,
          NODE_ENV: 'development'
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      })

      let isResolved = false
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          reject(new Error(`App failed to start within ${this.config.timeout}ms`))
        }
      }, this.config.timeout)

      // Monitor stdout for startup signals
      this.appProcess.stdout?.on('data', (data) => {
        const output = data.toString()

        // Only log startup and important messages, not every HTTP request
        if (output.includes('Ready') || output.includes('started server') || output.includes('Local:')) {
          console.log(`[APP] ${output.trim()}`)
        }

        // Look for Next.js ready signals
        if (output.includes('Ready') || output.includes('started server') || output.includes(`localhost:${this.config.port}`)) {
          if (!isResolved) {
            isResolved = true
            clearTimeout(timeout)
            resolve()
          }
        }
      })

      this.appProcess.stderr?.on('data', (data) => {
        const output = data.toString()
        // Only log actual errors, not expected auth failures or npm warnings
        if (!output.includes('npm warn') && !output.includes('API Error: Error [ApiError]: Unauthorized')) {
          console.error(`[APP ERROR] ${output.trim()}`)
        }
      })

      this.appProcess.on('error', (error) => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          reject(error)
        }
      })

      this.appProcess.on('exit', (code) => {
        if (!isResolved && code !== 0) {
          isResolved = true
          clearTimeout(timeout)
          reject(new Error(`App process exited with code ${code}`))
        }
      })
    })
  }

  /**
   * Wait for the app to be fully ready by polling the test endpoint
   */
  async waitForReady(): Promise<void> {
    // If port is already in use (managed by test-env.sh), do a quick check first
    const portInUse = await this.isPortInUse(this.config.port)
    if (portInUse) {
      // Try immediate connection first since app should already be running
      try {
        const response = await realFetch(`http://localhost:${this.config.port}/api/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true })
        })

        if (response.ok) {
          await this.validateAndRecreateApiKeysIfNeeded()
          return
        }
      } catch (error) {
        // Fall through to normal retry logic
      }
    }

    // Normal retry logic for startup
    let retries = this.config.retries
    while (retries > 0) {
      try {
        const response = await realFetch(`http://localhost:${this.config.port}/api/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true })
        })

        if (response.ok) {
          // Now validate API keys against the running app
          await this.validateAndRecreateApiKeysIfNeeded()

          return
        }
      } catch (error) {
        // Expected during startup
      }

      retries--
      if (retries > 0) {
        await delay(this.config.retryDelay)
      }
    }

    throw new Error(`App failed to become ready after ${this.config.retries} retries`)
  }

  /**
   * Stop the app and clean up
   */
  async stopApp(): Promise<void> {
    if (!this.appProcess) {
      console.log('🔌 No app process to stop (was using existing instance)')
      return
    }

    // Stopping app...

    return new Promise((resolve) => {
      if (!this.appProcess) {
        resolve()
        return
      }

      let isResolved = false
      const forceKillTimeout = setTimeout(() => {
        if (this.appProcess && !this.appProcess.killed && !isResolved) {
          console.log('🔪 Force killing app process...')
          this.appProcess.kill('SIGKILL')
        }
      }, 5000)

      this.appProcess.on('exit', () => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(forceKillTimeout)
          resolve()
        }
      })

      // Send SIGTERM first
      this.appProcess.kill('SIGTERM')
    })
  }


  /**
   * Get the base URL for API requests
   */
  getBaseUrl(): string {
    return `http://localhost:${this.config.port}`
  }

  /**
   * Make an authenticated API request using the test API key
   */
  async makeRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const apiKey = process.env.TEST_API_KEY_1
    if (!apiKey) {
      throw new Error('TEST_API_KEY_1 not found in environment. Run `npm run setup-test-users` first.')
    }

    const url = `${this.getBaseUrl()}${path}`
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...options.headers
    }

    return realFetch(url, {
      ...options,
      headers
    }) as Promise<Response>
  }

  /**
   * Make an unauthenticated API request
   */
  async makePublicRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.getBaseUrl()}${path}`
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    return realFetch(url, {
      ...options,
      headers
    }) as Promise<Response>
  }

  /**
   * Make an API request with a specific API key
   */
  async makeRequestWithKey(path: string, options: RequestInit = {}, apiKey: string): Promise<Response> {
    const url = `${this.getBaseUrl()}${path}`
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...options.headers
    }

    return realFetch(url, {
      ...options,
      headers
    }) as Promise<Response>
  }
}
