/**
 * Auth utilities -- simplified for standalone Postgres.
 * No session management needed.
 */

export async function getUserFromSession() {
  return {
    id: process.env.DEFAULT_USER_ID || 'default-user',
    email: process.env.DEFAULT_USER_EMAIL || 'user@localhost',
  }
}
