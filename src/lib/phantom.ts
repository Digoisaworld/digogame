/**
 * Phantom provider + encrypted mobile deeplink bridge.
 * Only public keys and explicit message signatures are exchanged. No seed phrase
 * or private key is requested, and this module never creates/sends transactions.
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

interface PhantomPublicKey { toString(): string; }
export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PhantomPublicKey | null;
  isConnected?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PhantomPublicKey }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, display?: 'utf8' | 'hex'): Promise<{ signature: Uint8Array; publicKey: PhantomPublicKey }>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

const CALLBACK = 'com.digo.evolution://phantom-callback';
const APP_URL = 'https://digoisaworld.github.io/digo-website/';
const PHANTOM = 'https://phantom.app/ul/v1';
type NativeSession = {
  dappSecretKey: Uint8Array;
  dappPublicKey: Uint8Array;
  sharedSecret: Uint8Array;
  session: string;
  address: string;
};
let nativeSession: NativeSession | null = null;

function getProvider(): PhantomProvider | null {
  if (typeof window === 'undefined') return null;
  const injected = window.phantom?.solana ?? window.solana;
  return injected?.isPhantom ? injected : null;
}

export function isPhantomInstalled(): boolean {
  return getProvider() !== null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodePayload(data: string, nonce: string, sharedSecret: Uint8Array): Record<string, unknown> {
  const opened = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), sharedSecret);
  if (!opened) throw new Error('Phantom response could not be decrypted. Please reconnect.');
  const parsed: unknown = JSON.parse(new TextDecoder().decode(opened));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Phantom returned an invalid response.');
  }
  return parsed as Record<string, unknown>;
}

function waitForRedirect(state: string, deeplink: string): Promise<URL> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let handlePromise: ReturnType<typeof App.addListener>;
    const timer = window.setTimeout(() => finish(new Error('Phantom approval timed out. Please try again.')), 120_000);
    const finish = (error?: Error, url?: URL) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      void handlePromise?.then((handle) => handle.remove()).catch(() => undefined);
      if (error) reject(error);
      else if (url) resolve(url);
      else reject(new Error('Phantom returned no callback.'));
    };

    handlePromise = App.addListener('appUrlOpen', ({ url }) => {
      let callback: URL;
      try { callback = new URL(url); } catch { return; }
      if (callback.protocol !== 'com.digo.evolution:' || callback.hostname !== 'phantom-callback') return;
      if (callback.searchParams.get('state') !== state) {
        finish(new Error('Phantom callback state mismatch. Please restart the connection.'));
        return;
      }
      const errorCode = callback.searchParams.get('errorCode');
      if (errorCode) {
        finish(new Error(callback.searchParams.get('errorMessage') || 'Phantom request was rejected.'));
        return;
      }
      finish(undefined, callback);
    });

    // Register the callback listener before handing control to Phantom.
    void handlePromise.then(() => { window.location.href = deeplink; }).catch(() => {
      finish(new Error('Could not register the Phantom return handler.'));
    });
  });
}

function encryptedRequest(
  payload: Record<string, unknown>,
  nonce: Uint8Array,
  sharedSecret: Uint8Array,
): string {
  const encrypted = nacl.box.after(
    new TextEncoder().encode(JSON.stringify(payload)),
    nonce,
    sharedSecret,
  );
  return bs58.encode(encrypted);
}

async function nativeConnect(): Promise<string> {
  const keys = nacl.box.keyPair();
  const state = bs58.encode(nacl.randomBytes(16));
  const redirect = `${CALLBACK}?state=${state}`;
  const params = new URLSearchParams({
    app_url: APP_URL,
    dapp_encryption_public_key: bs58.encode(keys.publicKey),
    redirect_link: redirect,
    cluster: 'mainnet-beta',
  });
  const callback = await waitForRedirect(state, `${PHANTOM}/connect?${params.toString()}`);
  const phantomKey = callback.searchParams.get('phantom_encryption_public_key');
  const nonce = callback.searchParams.get('nonce');
  const data = callback.searchParams.get('data');
  if (!phantomKey || !nonce || !data) throw new Error('Phantom did not return a complete connection response.');
  const sharedSecret = nacl.box.before(bs58.decode(phantomKey), keys.secretKey);
  const result = decodePayload(data, nonce, sharedSecret);
  if (typeof result.public_key !== 'string' || typeof result.session !== 'string') {
    throw new Error('Phantom connection response is missing wallet details.');
  }
  if (bs58.decode(result.public_key).length !== 32) throw new Error('Phantom returned an invalid Solana public key.');
  nativeSession = {
    dappSecretKey: keys.secretKey,
    dappPublicKey: keys.publicKey,
    sharedSecret,
    session: result.session,
    address: result.public_key,
  };
  return result.public_key;
}

export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (provider) {
    const res = await provider.connect();
    return res.publicKey.toString();
  }
  if (Capacitor.getPlatform() === 'android') return nativeConnect();
  throw new Error('Phantom was not detected. On mobile, open the game inside Phantom’s in-app browser, or install the Phantom app.');
}

export async function disconnectWallet(): Promise<void> {
  const provider = getProvider();
  if (provider) {
    try { await provider.disconnect(); } catch { /* already disconnected */ }
  }
  // Drop the local deeplink session. Phantom keeps its own approval record;
  // the next connect flow obtains a fresh, user-approved session.
  nativeSession = null;
}

export async function signChallenge(message: string): Promise<string> {
  const provider = getProvider();
  if (provider) {
    const encoded = new TextEncoder().encode(message);
    const { signature } = await provider.signMessage(encoded, 'utf8');
    return toBase64(signature);
  }
  if (Capacitor.getPlatform() !== 'android' || !nativeSession) {
    throw new Error('Reconnect Phantom before signing the verification message.');
  }
  const state = bs58.encode(nacl.randomBytes(16));
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const redirect = `${CALLBACK}?state=${encodeURIComponent(state)}`;
  const payload = encryptedRequest({
    message: bs58.encode(new TextEncoder().encode(message)),
    session: nativeSession.session,
    display: 'utf8',
  }, nonce, nativeSession.sharedSecret);
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(nativeSession.dappPublicKey),
    nonce: bs58.encode(nonce),
    redirect_link: redirect,
    payload,
  });
  const callback = await waitForRedirect(state, `${PHANTOM}/signMessage?${params.toString()}`);
  const responseNonce = callback.searchParams.get('nonce');
  const data = callback.searchParams.get('data');
  if (!responseNonce || !data) throw new Error('Phantom did not return a message signature.');
  const result = decodePayload(data, responseNonce, nativeSession.sharedSecret);
  if (typeof result.signature !== 'string') throw new Error('Phantom returned an invalid message signature.');
  const signature = bs58.decode(result.signature);
  if (signature.length !== nacl.sign.signatureLength) throw new Error('Phantom signature has an invalid length.');
  return toBase64(signature);
}

export function shortAddress(address: string | null): string {
  if (!address) return 'Not linked';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
