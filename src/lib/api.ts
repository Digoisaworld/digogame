import type { ModeId, RunResult, WorldId } from '../game/types';

const BASE = '/api';

export interface RunTicket {
  runId: string;
  seed: number;
  token: string;
  startedAt: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  mode: ModeId;
  world: WorldId;
  at: number;
  address?: string | null;
}

export interface RunVerdict {
  accepted: boolean;
  reason?: string;
  points?: number;
  best?: number;
  rank?: number;
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
export async function startRun(
  world: WorldId,
  mode: ModeId,
  stage: number,
): Promise<RunTicket> {
  return post<RunTicket>('/runs/start', { world, mode, stage });
}

export async function submitRun(
  token: string,
  result: RunResult,
  name: string,
  address: string | null,
): Promise<RunVerdict> {
  return post<RunVerdict>('/runs', { token, result, name, address });
}

export async function fetchLeaderboard(mode: ModeId): Promise<LeaderboardEntry[]> {
  const data = await get<{ entries: LeaderboardEntry[] }>(
    `/leaderboard?mode=${encodeURIComponent(mode)}&limit=25`,
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
