import { useState } from 'react';
import type { Profile } from '../game/progression';
import { stageDef } from '../game/progression';
import { connectWallet, disconnectWallet, isPhantomInstalled, shortAddress, signChallenge } from '../lib/phantom';
import { requestNonce, verifyWallet } from '../lib/api';

interface Props {
  profile: Profile;
  onBack: () => void;
  onSettings: (patch: Partial<Profile['settings']>) => void;
  onName: (name: string) => void;
  onWallet: (address: string | null, verified: boolean) => void;
  onReset: () => void;
}

type Note = { text: string; ok: boolean } | null;

export default function SettingsView({ profile, onBack, onSettings, onName, onWallet, onReset }: Props) {
  const s = profile.settings;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [name, setName] = useState(profile.name);

  async function linkWallet() {
    setNote(null);
    if (!isPhantomInstalled()) {
      setNote({
        text: 'Phantom was not detected in this browser. Install the Phantom extension or open this page inside Phantom’s in-app browser. The game stays fully playable without a wallet.',
        ok: false,
      });
      return;
    }
    setBusy(true);
    try {
      const address = await connectWallet();
      const challenge = await requestNonce(address);
      const signature = await signChallenge(challenge.message);
      const verdict = await verifyWallet(address, signature, challenge.message);
      onWallet(verdict.address, verdict.verified);
      setNote({
        text: verdict.verified
          ? 'Wallet verified with a message signature. Only your public address was shared — DIGO never asks for a seed phrase or private key, and no token transfer was made.'
          : 'The server could not verify that signature. Nothing was linked.',
        ok: verdict.verified,
      });
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : 'Wallet linking failed.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function unlinkWallet() {
    await disconnectWallet();
    onWallet(null, false);
    setNote({ text: 'Wallet disconnected. Your game progress is untouched.', ok: true });
  }

  const stage = stageDef(profile.stage);

  return (
    <div className="screen">
      <div className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Settings</h2>
        <span />
      </div>

      <div className="panel">
        <h3>Audio</h3>
        <label className="slider">
          <span>Music</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.music}
            onChange={(e) => onSettings({ music: Number(e.target.value) })}
          />
          <b>{Math.round(s.music * 100)}</b>
        </label>
        <label className="slider">
          <span>Effects</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.sfx}
            onChange={(e) => onSettings({ sfx: Number(e.target.value) })}
          />
          <b>{Math.round(s.sfx * 100)}</b>
        </label>
      </div>

      <div className="panel">
        <h3>Controls</h3>
        <div className="seg" role="group" aria-label="Control scheme">
          {(['drag', 'buttons', 'both'] as const).map((mode) => (
            <button
              key={mode}
              className={s.controls === mode ? 'active' : ''}
              onClick={() => onSettings({ controls: mode })}
            >
              {mode === 'drag' ? 'Touch pad' : mode === 'buttons' ? 'Buttons' : 'Both'}
            </button>
          ))}
        </div>
        <div className="toggle-row">
          <span>Haptic feedback</span>
          <button
            className={s.haptics ? 'btn primary' : 'btn'}
            style={{ width: 92, padding: '0.45rem' }}
            onClick={() => onSettings({ haptics: !s.haptics })}
          >
            {s.haptics ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="seg" role="group" aria-label="Graphics quality">
          {(['low', 'medium', 'high'] as const).map((q) => (
            <button key={q} className={s.quality === q ? 'active' : ''} onClick={() => onSettings({ quality: q })}>
              {q === 'low' ? 'Fast' : q === 'medium' ? 'Balanced' : 'Best'}
            </button>
          ))}
        </div>
        <p className="fineprint">
          Graphics quality caps particles and shadow resolution. “Fast” is recommended for older Android phones.
        </p>
      </div>

      <div className="panel">
        <h3>Player</h3>
        <label className="slider">
          <span>Name</span>
          <input
            type="text"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onName(name.trim() || 'Player')}
            style={{
              flex: 1,
              padding: '0.5rem 0.6rem',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#fff',
              fontSize: '0.85rem',
            }}
          />
        </label>
        <p className="fineprint">
          Evolution stage {stage.index} · {stage.name}. Points earned here are game points, not blockchain tokens.
        </p>
      </div>

      <div className="panel">
        <h3>Solana wallet (optional)</h3>
        <div className="wallet-card">
          <div className="toggle-row" style={{ padding: 0 }}>
            <span>{profile.wallet.address ? 'Linked address' : 'No wallet linked'}</span>
            <b className={profile.wallet.verified ? 'good' : 'muted'}>
              {profile.wallet.verified ? 'VERIFIED' : 'NOT LINKED'}
            </b>
          </div>
          {profile.wallet.address ? (
            <div className="wallet-address">{profile.wallet.address}</div>
          ) : (
            <p className="fineprint">
              Linking proves you own an address by signing a text message. DIGO never sees your private key or seed
              phrase and never moves funds.
            </p>
          )}
          {profile.wallet.address ? (
            <button className="btn" onClick={unlinkWallet} disabled={busy}>
              Disconnect wallet
            </button>
          ) : (
            <button className="btn primary" onClick={linkWallet} disabled={busy}>
              {busy ? 'Waiting for Phantom…' : 'Connect Phantom'}
            </button>
          )}
          {busy && <div className="spinner" />}
          {note && <div className={note.ok ? 'notice ok' : 'notice'}>{note.text}</div>}
          <p className="fineprint">
            DIGO token integration is prepared but not live: no transaction is created, signed or sent from this game,
            and no token balance is displayed. Rewards are validated server-side before they reach the leaderboard.
          </p>
        </div>
      </div>

      <div className="panel">
        <h3>Danger zone</h3>
        {confirmReset ? (
          <>
            <p className="fineprint">This erases levels, coins, unlocks and records stored in this browser.</p>
            <button
              className="btn primary"
              onClick={() => {
                onReset();
                setConfirmReset(false);
                setNote({ text: 'Progress reset. DIGO is back to stage 1.', ok: true });
              }}
            >
              Yes, erase my progress
            </button>
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setConfirmReset(true)}>
            Reset progress
          </button>
        )}
        <p className="fineprint">
          Address on file: {shortAddress(profile.wallet.address)} · version {profile.version}
        </p>
      </div>
    </div>
  );
}
