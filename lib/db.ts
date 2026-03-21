/**
 * Generic Postgres connection pool
 * Replaces all Supabase client usage with direct SQL queries
 */

import 'server-only'
import pg from 'pg'

const { Pool } = pg

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please check your .env.local file.'
      )
    }
    pool = new Pool({ connectionString })
  }
  return pool
}

/**
 * Execute a SQL query and return rows
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = getPool()
  const result = await client.query(text, params)
  return result.rows as T[]
}

/**
 * Execute a SQL query and return a single row or null
 */
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] || null
}

/**
 * Execute a SQL command (INSERT, UPDATE, DELETE) and return affected row count
 */
export async function execute(
  text: string,
  params?: any[]
): Promise<number> {
  const client = getPool()
  const result = await client.query(text, params)
  return result.rowCount ?? 0
}

/**
 * Execute a SQL command and return the rows (for INSERT...RETURNING, UPDATE...RETURNING)
 */
export async function executeReturning<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = getPool()
  const result = await client.query(text, params)
  return result.rows as T[]
}

/**
 * Get a client from the pool for transaction support
 */
export async function getClient(): Promise<pg.PoolClient> {
  return getPool().connect()
}
