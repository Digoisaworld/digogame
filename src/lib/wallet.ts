/**
 * Production wallet gate. Production never manufactures a wallet or silently
 * falls back to test mode. A player must connect Phantom and authenticate with
 * a one-time server challenge before starting a server-backed run.
 */
import { useSyncExternalStore } from 'react';
import {
  connectWallet as phantomConnect,
  cancelPendingConnection,
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
  balance: number;
  error: string | null;
  installed: boolean;
}

const initial: WalletState = {
  status: 'disconnected',
  address: null,
  mode: 'phantom',
  verified: false,
  balance: 0,
  error: null,
  installed: false,
};

let state: WalletState = { ...initial };
const listeners = new Set<() => void>();

function emit(): void { listeners.forEach((fn) => fn()); }

function set(patch: Partial<WalletState>): void {
  state = { ...state, ...patch };
  // Do not persist a "connected" flag or bearer session in localStorage.
  // A fresh app launch must reconnect and prove wallet ownership again.
  emit();
}

export function initWallet(): void {
  setApiSession(null);
  state = {
    ...initial,
    installed: isPhantomInstalled(),
  };
  emit();
}

export function getWallet(): WalletState { return state; }
export function subscribeWallet(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function useWallet(): WalletState {
  return useSyncExternalStore(subscribeWallet, getWallet, getWallet);
}

export async function connect(): Promise<void> {
  set({ status: 'connecting', error: null, verified: false });
  try {
    const address = await phantomConnect();
    set({ status: 'connected', address, mode: 'phantom', installed: true, verified: false, balance: 0 });
  } catch (err) {
    set({
      status: 'disconnected',
      address: null,
      verified: false,
      error: err instanceof Error ? err.message : 'Phantom connection was rejected.',
      installed: isPhantomInstalled(),
    });
  }
}

export function cancelConnect(): void {
  if (state.status !== 'connecting') return;
  cancelPendingConnection();
  set({
    status: 'disconnected',
    address: null,
    verified: false,
    error: null,
    mode: 'phantom',
    balance: 0,
  });
}

export async function signIn(): Promise<boolean> {
  if (state.status !== 'connected' || !state.address || state.mode !== 'phantom') return false;
  set({ error: null });
  try {
    const nonce = await requestNonce(state.address);
    const signature = await signChallenge(nonce.message);
    const res = await verifyWallet(state.address, signature, nonce.message);
    if (!res.verified || res.address !== state.address || !res.token) {
      throw new Error('The server could not verify ownership of this Phantom wallet.');
    }
    setApiSession(res.token);
    set({ verified: true, error: null });
    return true;
  } catch (err) {
    setApiSession(null);
    set({ verified: false, error: err instanceof Error ? err.message : 'Signature verification failed.' });
    return false;
  }
}

export async function disconnect(): Promise<void> {
  try {
    if (state.verified) await logoutSession();
  } catch {
    setApiSession(null);
  }
  await phantomDisconnect();
  setApiSession(null);
  set({ status: 'disconnected', address: null, verified: false, error: null, mode: 'phantom', balance: 0 });
}

export function isConnected(): boolean {
  return state.status === 'connected' && state.mode === 'phantom' && state.verified && Boolean(state.address);
}
