import type { Profile } from '../game/progression';
import { STAGES, stageDef, levelFromXp } from '../game/progression';
import { MODES, dailyKey, MODE_MAP } from '../game/modes';
import { WORLDS, WORLD_MAP } from '../game/worlds';
import { OBJECT_META, categoryOf, type FallingKind, type ModeId, type WorldId } from '../game/types';
import { shortAddress } from '../lib/phantom';

export type Screen =
  | 'menu'
  | 'modes'
  | 'worlds'
  | 'character'
  | 'missions'
  | 'achievements'
  | 'leaderboard'
  | 'profile'
  | 'settings'
  | 'codex'
  | 'game';

const NAV: { id: Screen; label: string; icon: string }[] = [
  { id: 'modes', label: 'Game Modes', icon: '🎮' },
  { id: 'character', label: 'Character', icon: '🦊' },
  { id: 'worlds', label: 'Worlds', icon: '🌍' },
  { id: 'missions', label: 'Missions', icon: '📜' },
  { id: 'achievements', label: 'Achievements', icon: '🏆' },
  { id: 'leaderboard', label: 'Leaderboard', icon: '📊' },
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'codex', label: 'Rewards & Dangers', icon: '📖' },
];

/** DIGO emblem drawn from the character palette of the active evolution stage. */
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export function DigoBadge({ stage, size = 132 }: { stage: number; size?: number }) {
  const def = stageDef(stage);
  const id = `digo-${stage}`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="digo-badge" role="img" aria-label="DIGO">
      <defs>
        <radialGradient id={`${id}-fur`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff3b0" />
          <stop offset="55%" stopColor={hex(def.fur)} />
          <stop offset="100%" stopColor={hex(def.furDark)} />
        </radialGradient>
        <radialGradient id={`${id}-eye`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#8ef6ff" />
          <stop offset="100%" stopColor="#0a7fa8" />
        </radialGradient>
        <linearGradient id={`${id}-gem`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9fbff" />
          <stop offset="100%" stopColor="#28c9ff" />
        </linearGradient>
      </defs>
      {/* ears */}
      <ellipse cx="26" cy="30" rx="15" ry="21" fill={hex(def.furDark)} transform="rotate(-22 26 30)" />
      <ellipse cx="94" cy="30" rx="15" ry="21" fill={hex(def.furDark)} transform="rotate(22 94 30)" />
      <ellipse cx="27" cy="32" rx="7" ry="11" fill="#ff9ec4" opacity="0.7" transform="rotate(-22 27 32)" />
      <ellipse cx="93" cy="32" rx="7" ry="11" fill="#ff9ec4" opacity="0.7" transform="rotate(22 93 32)" />
      {/* head */}
      <circle cx="60" cy="62" r="40" fill={`url(#${id}-fur)`} />
      <circle cx="60" cy="62" r="40" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
      {/* eyes */}
      <ellipse cx="45" cy="58" rx="11" ry="13" fill={`url(#${id}-eye)`} />
      <ellipse cx="75" cy="58" rx="11" ry="13" fill={`url(#${id}-eye)`} />
      <circle cx="47" cy="60" r="5" fill="#06202c" />
      <circle cx="77" cy="60" r="5" fill="#06202c" />
      <circle cx="43" cy="54" r="3" fill="#ffffff" />
      <circle cx="73" cy="54" r="3" fill="#ffffff" />
      {/* muzzle */}
      <ellipse cx="60" cy="78" rx="16" ry="11" fill="#fff6e0" />
      <ellipse cx="60" cy="73" rx="5" ry="4" fill="#3b2a1a" />
      <path d="M60 77 v5 M60 82 q-6 5 -11 1 M60 82 q6 5 11 1" stroke="#3b2a1a" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* chest gem */}
      <path d="M60 96 l9 8 -9 12 -9 -12 z" fill={`url(#${id}-gem)`} />
    </svg>
  );
}

export function MainMenu({
  profile,
  world,
  onPlay,
  onNav,
}: {
  profile: Profile;
  world: WorldId;
  onPlay: () => void;
  onNav: (screen: Screen) => void;
}) {
  const level = levelFromXp(profile.xp);
  const stage = stageDef(profile.stage);
  const w = WORLD_MAP[world];
  return (
    <div className="screen menu-screen">
      <header className="topbar">
        <div className="stat-chip">
          <b>Lv {level.level}</b>
          <span>{profile.xp.toLocaleString()} XP</span>
        </div>
        <div className="stat-chip gold">
          <b>🪙 {profile.coins.toLocaleString()}</b>
          <span>coins</span>
        </div>
        <button className="stat-chip link" onClick={() => onNav('profile')}>
          <b>{profile.wallet.verified ? '🔗' : '👛'}</b>
          <span>{shortAddress(profile.wallet.address)}</span>
        </button>
      </header>

      <section className="hero">
        <div className="hero-glow" />
        <DigoBadge stage={profile.stage} size={150} />
        <h1 className="game-title">DIGO</h1>
        <div className="game-subtitle">EVOLUTION</div>
        <div className="stage-line">
          {stage.name} · {stage.title}
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ width: `${(level.into / level.needed) * 100}%` }} />
        </div>
        <div className="xp-label">
          {level.into} / {level.needed} XP to level {level.level + 1}
        </div>
      </section>

      <button className="btn play" onClick={onPlay}>
        <span className="play-main">▶ PLAY</span>
        <span className="play-sub">
          {w.name} · Endless Survival
        </span>
      </button>

      <div className="nav-grid">
        {NAV.map((item) => (
          <button key={item.id} className="nav-tile" onClick={() => onNav(item.id)}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <footer className="footnote">
        Hold &amp; drag to move DIGO · Collect rewards · Dodge everything that glows red
      </footer>
    </div>
  );
}

export function ModeSelect({
  profile,
  onBack,
  onPlay,
}: {
  profile: Profile;
  onBack: () => void;
  onPlay: (mode: ModeId) => void;
}) {
  const today = dailyKey();
  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Game Modes</h2>
        <span />
      </header>
      <div className="card-list">
        {MODES.map((mode) => {
          const best = profile.bestScores[mode.id] ?? 0;
          const dailyDone = mode.id === 'daily' && profile.dailyDone === today;
          return (
            <button key={mode.id} className="mode-card" onClick={() => onPlay(mode.id)}>
              <div className="mode-icon">{mode.icon}</div>
              <div className="mode-body">
                <div className="mode-name">{mode.name}</div>
                <div className="mode-tag">{mode.tagline}</div>
                <div className="mode-meta">
                  <span>{mode.duration ? `${mode.duration}s` : 'Endless'}</span>
                  <span>{mode.lives} lives</span>
                  <span>{mode.bossInterval ? `Boss / ${mode.bossInterval}s` : 'No boss'}</span>
                </div>
                <ul className="mode-objectives">
                  {mode.objective ? (
                    <li key={mode.objective.label}>
                      {mode.objective.label}: <b>{mode.objective.target}</b>
                    </li>
                  ) : (
                    <li>Pure survival — survive as long as you can</li>
                  )}
                </ul>
              </div>
              <div className="mode-side">
                <div className="best">{best > 0 ? best.toLocaleString() : '—'}</div>
                <div className="best-label">best</div>
                {dailyDone && <div className="done-tag">DONE</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorldSelect({
  profile,
  selected,
  onBack,
  onSelect,
}: {
  profile: Profile;
  selected: WorldId;
  onBack: () => void;
  onSelect: (world: WorldId) => void;
}) {
  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Worlds</h2>
        <span />
      </header>
      <div className="card-list">
        {WORLDS.map((world) => {
          const unlocked = profile.unlockedWorlds.includes(world.id);
          const active = selected === world.id;
          return (
            <button
              key={world.id}
              className={`world-card ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
              style={{
                background: `linear-gradient(135deg, ${world.skyTop}, ${world.skyBottom})`,
                borderColor: world.accent,
              }}
              onClick={() => unlocked && onSelect(world.id)}
              disabled={!unlocked}
            >
              <div className="world-head">
                <span className="world-index">{world.index + 1}</span>
                <div>
                  <div className="world-name">{world.name}</div>
                  <div className="world-sub">{world.subtitle}</div>
                </div>
                {!unlocked && <span className="lock">🔒 Lv {world.unlockLevel}</span>}
                {active && <span className="active-tag">SELECTED</span>}
              </div>
              <p className="world-desc">{world.description}</p>
              <div className="world-hazard" style={{ color: world.accent2 }}>
                ⚠ {world.hazard}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CharacterSelect({
  profile,
  onBack,
  onSelect,
}: {
  profile: Profile;
  onBack: () => void;
  onSelect: (stage: number) => void;
}) {
  const level = levelFromXp(profile.xp);
  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Character Evolution</h2>
        <span />
      </header>
      <div className="evo-strip">
        {STAGES.map((s) => {
          const unlocked = s.index <= profile.stage;
          const active = s.index === profile.stage;
          return (
            <button
              key={s.index}
              className={`evo-card ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}`}
              onClick={() => unlocked && onSelect(s.index)}
            >
              <DigoBadge stage={s.index} size={64} />
              <div className="evo-name">{s.name}</div>
              <div className="evo-title">{s.title}</div>
              <div className="evo-xp">
                {unlocked ? (active ? 'ACTIVE' : 'UNLOCKED') : `${s.xpRequired.toLocaleString()} XP`}
              </div>
            </button>
          );
        })}
      </div>
      <div className="panel flat">
        <h3>Evolution path</h3>
        <p className="muted">
          DIGO grows with every run. XP comes from collected rewards, survival time and defeated
          bosses. Each evolution keeps the same golden fur, oversized cyan eyes and chest crystal,
          but upgrades armour, aura and abilities.
        </p>
        <div className="stat-row">
          <span>Level</span>
          <b>{level.level}</b>
        </div>
        <div className="stat-row">
          <span>Total XP</span>
          <b>{profile.xp.toLocaleString()}</b>
        </div>
        <div className="stat-row">
          <span>Current form</span>
          <b>{stageDef(profile.stage).name}</b>
        </div>
      </div>
    </div>
  );
}

export function Codex({ onBack }: { onBack: () => void }) {
  const kinds = Object.keys(OBJECT_META) as FallingKind[];
  const rewards = kinds.filter((k) => categoryOf(k) === 'reward');
  const dangers = kinds.filter((k) => categoryOf(k) === 'danger');
  const powers = kinds.filter((k) => categoryOf(k) === 'power');
  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>Rewards &amp; Dangers</h2>
        <span />
      </header>

      <div className="panel flat">
        <h3 className="good">✅ Collect these</h3>
        <div className="codex-grid">
          {rewards.map((k) => (
            <div key={k} className="codex-item reward">
              <span className="codex-icon">{OBJECT_META[k].icon}</span>
              <div>
                <b>{OBJECT_META[k].label}</b>
                <p>{OBJECT_META[k].blurb}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel flat">
        <h3 className="bad">⛔ Avoid these</h3>
        <div className="codex-grid">
          {dangers.map((k) => (
            <div key={k} className="codex-item danger">
              <span className="codex-icon">{OBJECT_META[k].icon}</span>
              <div>
                <b>{OBJECT_META[k].label}</b>
                <p>{OBJECT_META[k].blurb}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel flat">
        <h3>⚡ Power-ups</h3>
        <div className="codex-grid">
          {powers.map((k) => (
            <div key={k} className="codex-item power">
              <span className="codex-icon">{OBJECT_META[k].icon}</span>
              <div>
                <b>{OBJECT_META[k].label}</b>
                <p>{OBJECT_META[k].blurb}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel flat">
        <h3>Controls</h3>
        <p className="muted">
          Press and hold anywhere in the bottom control area, then slide left or right. DIGO follows
          your finger continuously — no tapping required. Optional ◀ ▶ buttons and keyboard arrows
          work too.
        </p>
      </div>
    </div>
  );
}

export { MODE_MAP };
