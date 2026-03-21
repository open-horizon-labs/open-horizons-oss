/**
 * Jest Global Teardown for API Tests
 *
 * Stops the shared Next.js production server started by global-setup.js.
 * Reads the PID from the info file written during setup.
 */

const { readFileSync, unlinkSync, existsSync } = require('fs')
const { join } = require('path')

const PORT_FILE = join(__dirname, '../../.api-test-server.json')

module.exports = async function globalTeardown() {
  console.log('[global-teardown] Stopping shared test server...')

  if (!existsSync(PORT_FILE)) {
    console.log('[global-teardown] No server info file found, nothing to stop.')
    return
  }

  try {
    const serverInfo = JSON.parse(readFileSync(PORT_FILE, 'utf8'))
    const { pid } = serverInfo

    if (pid) {
      try {
        // Kill the process group (negative PID) to catch child processes
        process.kill(-pid, 'SIGTERM')
        console.log(`[global-teardown] Sent SIGTERM to process group ${pid}`)
      } catch (err) {
        if (err.code === 'ESRCH') {
          console.log(`[global-teardown] Process ${pid} already exited.`)
        } else {
          // Try killing just the process if group kill fails
          try {
            process.kill(pid, 'SIGTERM')
            console.log(`[global-teardown] Sent SIGTERM to process ${pid}`)
          } catch (innerErr) {
            if (innerErr.code !== 'ESRCH') {
              console.error(
                `[global-teardown] Failed to kill process ${pid}:`,
                innerErr
              )
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[global-teardown] Error reading server info:', err)
  } finally {
    // Clean up the info file
    try {
      unlinkSync(PORT_FILE)
    } catch {
      // Ignore cleanup errors
    }
    // Also clean up legacy port file if it exists
    const legacyPortFile = join(__dirname, '../../.api-test.port')
    try {
      if (existsSync(legacyPortFile)) {
        unlinkSync(legacyPortFile)
      }
    } catch {
      // Ignore
    }
  }

  console.log('[global-teardown] Done.')
}
