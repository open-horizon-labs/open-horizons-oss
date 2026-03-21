/**
 * Jest Global Setup for API Tests
 *
 * Builds the Next.js app once, then starts `next start` on a known port.
 * The port is written to a JSON file so test files (running in worker processes)
 * can read it and configure their harness instances.
 *
 * This replaces the per-file `harness.startApp()` pattern, cutting total
 * API test time from ~10 minutes to under 2 minutes.
 */

const { spawn, execSync } = require('child_process')
const { writeFileSync } = require('fs')
const { join } = require('path')

const PORT = 3099 // Use a high port unlikely to conflict
const PORT_FILE = join(__dirname, '../../.api-test-server.json')

async function waitForServer(port, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      // Any HTTP response (even 500) proves the server is accepting connections.
      // The /api/status endpoint may return errors if DATABASE_URL isn't set yet,
      // but that's fine -- the test files load their own env via dotenv.
      await fetch(`http://localhost:${port}/api/status`)
      return
    } catch {
      // Connection refused -- server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`)
}

module.exports = async function globalSetup() {
  const projectRoot = join(__dirname, '../..')

  console.log('[global-setup] Building Next.js app...')
  const buildStart = Date.now()
  execSync('npx next build', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  })
  console.log(
    `[global-setup] Build completed in ${((Date.now() - buildStart) / 1000).toFixed(1)}s`
  )

  console.log(`[global-setup] Starting Next.js production server on port ${PORT}...`)
  const serverProcess = spawn('npx', ['next', 'start', '-p', PORT.toString()], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
    detached: true,
  })

  // Store PID so globalTeardown can kill it
  const serverInfo = {
    pid: serverProcess.pid,
    port: PORT,
    baseUrl: `http://localhost:${PORT}`,
  }
  writeFileSync(PORT_FILE, JSON.stringify(serverInfo, null, 2))

  // Don't let the server process keep the parent alive if something goes wrong
  serverProcess.unref()

  // Log server output for debugging
  serverProcess.stdout?.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg) console.log(`[server] ${msg}`)
  })
  serverProcess.stderr?.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg && !msg.includes('ExperimentalWarning')) {
      console.error(`[server:err] ${msg}`)
    }
  })

  serverProcess.on('error', (err) => {
    console.error('[global-setup] Failed to start server:', err)
  })

  console.log(
    `[global-setup] Waiting for server to be ready (pid: ${serverProcess.pid})...`
  )
  await waitForServer(PORT)
  console.log('[global-setup] Server is ready.')
}
