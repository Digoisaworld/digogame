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

export async function query(text, values = []) {
  if (!pool) throw new Error('PostgreSQL is not configured.');
  return pool.query(text, values);
}

export async function verifyDatabase() {
  if (!pool) {
    databaseReady = false;
    return false;
  }
  const result = await pool.query(`
    SELECT
      to_regclass('public.players') IS NOT NULL AS players,
      to_regclass('public.wallet_challenges') IS NOT NULL AS wallet_challenges,
      to_regclass('public.player_sessions') IS NOT NULL AS player_sessions,
      to_regclass('public.player_progress') IS NOT NULL AS player_progress,
      to_regclass('public.game_runs') IS NOT NULL AS game_runs,
      to_regclass('public.run_results') IS NOT NULL AS run_results
  `);
  const schema = result.rows[0];
  if (!Object.values(schema).every(Boolean)) {
    databaseReady = false;
    throw new Error('PostgreSQL schema is missing. Apply db/migrations/001_initial_schema.sql before starting production.');
  }
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
