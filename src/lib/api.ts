import type { RunResult, WorldId } from '../game/types';

/**
 * Client for the DIGO game API.
 *
 * A run ticket is requested before gameplay and validated on the server when
 * the run is submitted, so the leaderboard cannot be filled with invented
 * scores. Tickets carry the server-chosen seed, which the client uses to spawn
 * the level deterministically.
 */

const BASE = '/api';

export interface RunTicket {
  runId: string;
  seed: number;
  token: string;
  startedAt: number;
}

export interface LeaderboardEntry {
  name: string;
  total: number;
  score: number;
  level: number;
  world: WorldId;
  stars: number;
  at: number;
  address?: string | null;
}

export interface RunVerdict {
  accepted: boolean;
  reason?: string;
  total?: number;
  best?: number;
  rank?: number;
  stars?: number;
  verified?: boolean;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

/** Asks the server for a signed run ticket (seed + start time). */
export async function startRun(level: number): Promise<RunTicket> {
  return post<RunTicket>('/runs/start', { level });
}

export async function submitRun(
  token: string,
  result: RunResult,
  name: string,
  address: string | null,
): Promise<RunVerdict> {
  return post<RunVerdict>('/runs', { token, result, name, address });
}

export async function fetchLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const data = await get<{ entries: LeaderboardEntry[] }>(
    `/leaderboard?limit=${encodeURIComponent(String(limit))}`,
  );
  return data.entries ?? [];
}

export interface NonceResponse {
  address: string;
  message: string;
  expiresAt: number;
}

export async function requestNonce(address: string): Promise<NonceResponse> {
  return post<NonceResponse>('/wallet/nonce', { address });
}

export async function verifyWallet(
  address: string,
  signature: string,
  message: string,
): Promise<{ verified: boolean; address: string; linkedAt: number }> {
  return post('/wallet/verify', { address, signature, message });
}
