/**
 * Phantom wallet integration — with an explicit, clearly-labelled mock mode.
 *
 * Real path (Phantom installed):
 *   connect()  -> provider.connect()  -> public key only
 *   signIn()   -> server nonce -> provider.signMessage() -> server ed25519 verify
 *
 * Mock path (no extension / test mode):
 *   Generates a local, obviously simulated address so the whole connect /
 *   status / disconnect / gameplay-gate flow can be exercised without any
 *   blockchain activity. Mock balances are labelled "simulated" in the UI.
 *
 * Security: private keys and seed phrases are never requested, read or stored.
 * No transaction is ever built, signed or sent from this module.
 */

import { useSyncExternalStore } from 'react';
import {
  connectWallet as phantomConnect,
  disconnectWallet as phantomDisconnect,
  isPhantomInstalled,
  signChallenge,
} from './phantom';
import { logoutSession, requestNonce, setApiSession, verifyWallet } from './api';

export type WalletMode = 'phantom' | 'mock';
export type WalletStatus = 'disconnected' | 'connecting' | 'connected';

export interface WalletState {
  status: WalletStatus;
  address: string | null;
  mode: WalletMode;
  verified: boolean;
  /** Simulated DIGO balance (never a real token balance). */
  balance: number;
  error: string | null;
  installed: boolean;
}

const STORAGE_KEY = 'digo.wallet.v2';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const initial: WalletState = {
  status: 'disconnected',
  address: null,
  mode: 'mock',
  verified: false,
  balance: 0,
  error: null,
  installed: false,
};

let state: WalletState = { ...initial };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

function set(patch: Partial<WalletState>): void {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        address: state.address,
        mode: state.mode,
        verified: false,
        balance: state.balance,
      }),
    );
  } catch {
    /* storage can be unavailable in private mode */
  }
  emit();
}

function randomAddress(): string {
  let out = '';
  for (let i = 0; i < 44; i += 1) {
    out += B58[Math.floor(Math.random() * B58.length)];
  }
  return out;
}

export function initWallet(): void {
  const installed = isPhantomInstalled();
  let restored: Partial<WalletState> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) restored = JSON.parse(raw) as Partial<WalletState>;
  } catch {
    restored = {};
  }
  state = {
    ...initial,
    installed,
    address: restored.address ?? null,
    mode: restored.mode === 'phantom' ? 'phantom' : 'mock',
    verified: false,
    balance: typeof restored.balance === 'number' ? restored.balance : 0,
    status: restored.address ? 'connected' : 'disconnected',
  };
  emit();
}

export function getWallet(): WalletState {
  return state;
}

export function subscribeWallet(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useWallet(): WalletState {
  return useSyncExternalStore(subscribeWallet, getWallet, getWallet);
}

export async function connect(forceMock = false): Promise<void> {
  set({ status: 'connecting', error: null });
  const installed = isPhantomInstalled();

  if (installed && !forceMock) {
    try {
      const address = await phantomConnect();
      set({ status: 'connected', address, mode: 'phantom', installed: true, verified: false });
      return;
    } catch (err) {
      set({
        status: 'disconnected',
        error: err instanceof Error ? err.message : 'Phantom connection was rejected.',
        installed: true,
      });
      return;
    }
  }

  // Test mode: simulated wallet, no chain interaction at all.
  const address = randomAddress();
  set({
    status: 'connected',
    address,
    mode: 'mock',
    installed,
    verified: false,
    balance: state.balance,
    error: null,
  });
}

export async function signIn(): Promise<boolean> {
  if (state.status !== 'connected' || !state.address) return false;
  if (state.mode === 'mock') {
    // Simulated verification: nothing is signed, nothing is sent on-chain.
    set({ verified: true });
    return true;
  }
  try {
    const nonce = await requestNonce(state.address);
    const signature = await signChallenge(nonce.message);
    const res = await verifyWallet(state.address, signature, nonce.message);
    setApiSession(res.token);
    set({ verified: res.verified });
    return res.verified;
  } catch (err) {
    set({ error: err instanceof Error ? err.message : 'Signature verification failed.' });
    return false;
  }
}

export async function disconnect(): Promise<void> {
  try { await logoutSession(); } catch { setApiSession(null); }
  if (state.mode === 'phantom') await phantomDisconnect();
  set({ status: 'disconnected', address: null, verified: false, error: null, mode: 'mock' });
}

/** Adds simulated DIGO earned in a level. Never a token transfer. */
export function addSimulatedBalance(amount: number): void {
  set({ balance: Math.max(0, state.balance + Math.round(amount)) });
}

export function isConnected(): boolean {
  return state.status === 'connected' && Boolean(state.address);
}
