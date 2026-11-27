import type { RunResult, WorldId } from '../game/types';

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
let sessionToken: string | null = null;

export function setApiSession(token: string | null): void {
  sessionToken = token;
}

function headers(auth = false): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(auth && sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
  };
}

async function post<T>(path: string, body: unknown, auth = false): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: headers(auth),
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    if (res.status === 401 && auth) setApiSession(null);
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export interface RunTicket { runId: string; seed: number; token: string; startedAt: number; }
export interface LeaderboardEntry {
  name: string; total: number; score: number; level: number; world: WorldId;
  stars: number; at: number; address?: string | null;
}
export interface RunVerdict {
  accepted: boolean; reason?: string; total?: number; best?: number;
  rank?: number; stars?: number; verified?: boolean;
}
export interface NonceResponse { address: string; message: string; expiresAt: number; }

export async function startRun(level: number): Promise<RunTicket> {
  return post<RunTicket>('/runs/start', { level }, true);
}
export async function submitRun(token: string, result: RunResult, name: string): Promise<RunVerdict> {
  return post<RunVerdict>('/runs', { token, result, name }, true);
}
export async function fetchLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const data = await get<{ entries: LeaderboardEntry[] }>(`/leaderboard?limit=${encodeURIComponent(String(limit))}`);
  return data.entries ?? [];
}
export async function requestNonce(address: string): Promise<NonceResponse> {
  return post<NonceResponse>('/wallet/nonce', { address });
}
export async function verifyWallet(address: string, signature: string, message: string): Promise<{
  verified: boolean; address: string; linkedAt: number; token: string; expiresAt: number;
}> {
  return post('/wallet/verify', { address, signature, message });
}
export async function logoutSession(): Promise<void> {
  try { await post('/auth/logout', {}, true); } finally { setApiSession(null); }
}
