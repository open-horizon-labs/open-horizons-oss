/**
 * API Test Harness
 * Manages starting/stopping the Next.js app for real API testing
 */

import { spawn, ChildProcess } from 'child_process'
import { setTimeout as delay } from 'timers/promises'
import { join } from 'path'
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
        console.log(`Using external test API at ${process.env.TEST_API_BASE_URL}`)
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
          return storedPort
        }
      } catch (error) {
        // Invalid port file, continue to scan
      }
    }

    // Scan for available port in range 3003-3020
    for (let port = 3003; port <= 3020; port++) {
      if (!this.isPortInUseSync(port)) {
        // Store the port for future use
        writeFileSync(portFile, port.toString())
        return port
      }
    }

    // Fallback to 3003
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
      console.log(`Port ${this.config.port} already in use - using existing instance`)
      return Promise.resolve()
    }

    console.log(`Starting Next.js app on port ${this.config.port}`)

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

        // Only log startup and important messages
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
        if (!output.includes('npm warn')) {
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
   * Wait for the app to be fully ready by polling the status endpoint
   */
  async waitForReady(): Promise<void> {
    let retries = this.config.retries
    while (retries > 0) {
      try {
        const response = await realFetch(`http://localhost:${this.config.port}/api/status`)
        if (response.ok) {
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
      return
    }

    return new Promise((resolve) => {
      if (!this.appProcess) {
        resolve()
        return
      }

      let isResolved = false
      const forceKillTimeout = setTimeout(() => {
        if (this.appProcess && !this.appProcess.killed && !isResolved) {
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
   * Make an API request
   */
  async makeRequest(path: string, options: RequestInit = {}): Promise<Response> {
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
   * Make a public API request (alias for makeRequest, no auth needed)
   */
  async makePublicRequest(path: string, options: RequestInit = {}): Promise<Response> {
    return this.makeRequest(path, options)
  }

  /**
   * No-op in OSS (kept for test compatibility)
   */
  async ensureTestUsersExist(): Promise<void> {
    // No auth setup needed in standalone mode
  }

  /**
   * Make an API request with a specific key (no-op in OSS, kept for test compatibility)
   */
  async makeRequestWithKey(path: string, options: RequestInit = {}, _apiKey?: string): Promise<Response> {
    return this.makeRequest(path, options)
  }
}
