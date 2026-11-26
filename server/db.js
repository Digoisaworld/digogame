/**
 * PostgreSQL runtime connection for DIGO EVOLUTION.
 * Production is fail-closed: no silent fallback to process memory.
 */
import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL || '';

if (process.env.NODE_ENV === 'production' && !databaseUrl) {
  throw new Error('DATABASE_URL is required in production; refusing non-durable storage.');
}

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DB_POOL_MAX || 5),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
      query_timeout: 12000,
      application_name: 'digo-evolution',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    })
  : null;

let databaseReady = false;

export async function verifyDatabase() {
  if (!pool) {
    databaseReady = false;
    return false;
  }
  await pool.query('SELECT 1');
  databaseReady = true;
  return true;
}

export function databaseStatus() {
  return {
    configured: Boolean(pool),
    ready: databaseReady,
    engine: pool ? 'postgresql' : 'memory-development-only',
  };
}

export async function closeDatabase() {
  databaseReady = false;
  if (pool) await pool.end();
}
