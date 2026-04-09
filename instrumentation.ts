/**
 * Next.js Instrumentation Hook
 *
 * Runs once on server startup. Used for one-time initialization
 * that must happen before the first request is served.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { seedNodeTypes } = await import('./lib/config/seed-node-types')
    await seedNodeTypes()
  }
}
