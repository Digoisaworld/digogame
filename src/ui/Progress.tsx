import { useEffect, useState } from 'react';
import type { Profile } from '../game/progression';
import { ACHIEVEMENTS, MISSIONS, missionProgress, stageDef, levelFromXp } from '../game/progression';
import { MODES } from '../game/modes';
import type { ModeId } from '../game/types';
import { WORLD_MAP } from '../game/worlds';
import { fetchLeaderboard, type LeaderboardEntry } from '../lib/api';
import { shortAddress } from '../lib/phantom';
import { DigoBadge } from './Menu';

export function MissionsView({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Missions</h2>
        <span />
      </header>
      <div className="card-list">
        {MISSIONS.map((mission) => {
          const progress = missionProgress(profile, mission);
          const claimed = profile.claimedMissions.includes(mission.id);
          return (
            <div key={mission.id} className={`mission-card ${claimed ? 'claimed' : ''}`}>
              <div className="mission-head">
                <b>{mission.title}</b>
                <span className="reward">
                  +{mission.rewardCoins} 🪙 · +{mission.rewardXp} XP
                </span>
              </div>
              <p className="muted">{mission.description}</p>
              <div className="objective-bar">
                <div
                  className="objective-fill"
                  style={{ width: `${(progress / mission.target) * 100}%` }}
                />
              </div>
              <div className="mission-foot">
                <span>
                  {progress} / {mission.target}
                </span>
                <span className={claimed ? 'good' : 'muted'}>{claimed ? 'COMPLETE' : 'IN PROGRESS'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AchievementsView({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const counters: Record<string, number> = {
    coins: profile.totalCollected,
    diamonds: profile.missions.m_diamond ?? 0,
    score: Math.max(...Object.values(profile.bestScores).map((v) => v ?? 0), 0),
    runs: profile.totalRuns,
    combo: profile.maxCombo,
    bosses: profile.totalBosses,
    powerups: profile.totalPowerups,
    time: Math.floor(profile.totalTime),
    worlds: profile.unlockedWorlds.length,
  };
  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Achievements</h2>
        <span className="count">
          {profile.achievements.length}/{ACHIEVEMENTS.length}
        </span>
      </header>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = profile.achievements.includes(a.id);
          const value = Math.min(counters[a.metric] ?? 0, a.target);
          return (
            <div key={a.id} className={`ach-card ${unlocked ? 'unlocked' : ''}`}>
              <div className="ach-icon">{a.icon}</div>
              <b>{a.title}</b>
              <p className="muted">{a.description}</p>
              <div className="objective-bar">
                <div className="objective-fill" style={{ width: `${(value / a.target) * 100}%` }} />
              </div>
              <span className="ach-progress">
                {unlocked ? 'UNLOCKED' : `${value} / ${a.target}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeaderboardView({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<ModeId>('endless');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetchLeaderboard(mode)
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Leaderboard</h2>
        <span />
      </header>
      <div className="tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`tab ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.icon}
          </button>
        ))}
      </div>
      {state === 'loading' && <div className="spinner" />}
      {state === 'error' && (
        <div className="panel flat">
          <p className="muted">Leaderboard is unreachable right now. Your scores are still saved on this device.</p>
        </div>
      )}
      {state === 'ready' && entries.length === 0 && (
        <div className="panel flat">
          <p className="muted">No verified runs yet for this mode. Be the first — play a run and it will appear here.</p>
        </div>
      )}
      {state === 'ready' && entries.length > 0 && (
        <div className="lb-list">
          {entries.map((e, i) => (
            <div key={`${e.name}-${e.at}-${i}`} className="lb-row">
              <span className={`rank r${i + 1}`}>{i + 1}</span>
              <div className="lb-name">
                <b>{e.name}</b>
                <span>{WORLD_MAP[e.world]?.name ?? e.world}</span>
              </div>
              <div className="lb-score">
                {e.score.toLocaleString()}
                {e.address && <span>{shortAddress(e.address)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfileView({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const level = levelFromXp(profile.xp);
  const stage = stageDef(profile.stage);
  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Profile</h2>
        <span />
      </header>
      <div className="profile-card">
        <DigoBadge stage={profile.stage} size={92} />
        <div>
          <h3>{profile.name}</h3>
          <p className="muted">
            {stage.name} · Level {level.level}
          </p>
          <div className="xp-track slim">
            <div className="xp-fill" style={{ width: `${(level.into / level.needed) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="panel flat">
        <h3>Lifetime stats</h3>
        <div className="stat-row">
          <span>Runs played</span>
          <b>{profile.totalRuns}</b>
        </div>
        <div className="stat-row">
          <span>Rewards collected</span>
          <b>{profile.totalCollected}</b>
        </div>
        <div className="stat-row">
          <span>Time survived</span>
          <b>{Math.floor(profile.totalTime / 60)}m {Math.floor(profile.totalTime % 60)}s</b>
        </div>
        <div className="stat-row">
          <span>Bosses defeated</span>
          <b>{profile.totalBosses}</b>
        </div>
        <div className="stat-row">
          <span>Best combo</span>
          <b>x{profile.maxCombo}</b>
        </div>
        <div className="stat-row">
          <span>Power-ups used</span>
          <b>{profile.totalPowerups}</b>
        </div>
        <div className="stat-row">
          <span>Worlds unlocked</span>
          <b>{profile.unlockedWorlds.length}/7</b>
        </div>
      </div>

      <div className="panel flat">
        <h3>Best scores</h3>
        {MODES.map((m) => (
          <div key={m.id} className="stat-row">
            <span>
              {m.icon} {m.name}
            </span>
            <b>{(profile.bestScores[m.id] ?? 0).toLocaleString()}</b>
          </div>
        ))}
      </div>

      <div className="panel flat">
        <h3>Wallet</h3>
        <p className="muted">
          {profile.wallet.verified
            ? `Linked & verified · ${shortAddress(profile.wallet.address)}`
            : 'No verified wallet linked. The game is fully playable without one.'}
        </p>
        <p className="fineprint">
          DIGO points are off-chain game points. No DIGO token is live, and this build never creates,
          signs or sends a blockchain transaction.
        </p>
      </div>
    </div>
  );
}
