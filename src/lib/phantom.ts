/**
 * Phantom wallet bridge.
 *
 * Security rules enforced here:
 *  - Only the public key is read. Private keys / seed phrases are never
 *    requested, read or transmitted.
 *  - Authentication uses signMessage (a plain text challenge from the server).
 *  - No transaction is ever built, signed or sent by this module, and no token
 *    balance is faked. DIGO points stay off-chain until a real program exists.
 */

interface PhantomPublicKey {
  toString(): string;
}

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PhantomPublicKey | null;
  isConnected?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PhantomPublicKey }>;
  disconnect(): Promise<void>;
  signMessage(
    message: Uint8Array,
    display?: 'utf8' | 'hex',
  ): Promise<{ signature: Uint8Array; publicKey: PhantomPublicKey }>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

export function getProvider(): PhantomProvider | null {
  if (typeof window === 'undefined') return null;
  const injected = window.phantom?.solana ?? window.solana;
  if (injected?.isPhantom) return injected;
  return null;
}

export function isPhantomInstalled(): boolean {
  return getProvider() !== null;
}

export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error('Phantom wallet not found. Install Phantom to link a wallet.');
  }
  const res = await provider.connect();
  return res.publicKey.toString();
}

export async function disconnectWallet(): Promise<void> {
  const provider = getProvider();
  if (!provider) return;
  try {
    await provider.disconnect();
  } catch {
    /* wallet may already be disconnected */
  }
}

/** Signs the server challenge. Returns the base64 signature for verification. */
export async function signChallenge(message: string): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error('Phantom wallet not found.');
  const encoded = new TextEncoder().encode(message);
  const { signature } = await provider.signMessage(encoded, 'utf8');
  return bytesToBase64(signature);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function shortAddress(address: string | null): string {
  if (!address) return 'Not linked';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
