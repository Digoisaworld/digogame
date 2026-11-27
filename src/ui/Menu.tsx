import { useMemo, useState } from 'react';
import { Icon, type IconName } from './icons';
import {
  ACHIEVEMENTS,
  isUnlocked,
  levelRecord,
  resetProgress,
  setName,
  totalStars,
  updateSettings,
  useProgress,
  type Progress,
} from '../game/progress';
import { CHAPTERS, LAST_LEVEL, LEVELS, goalLabel, levelById, nextLevelId } from '../game/levels';
import { worldById } from '../game/worlds';
import { DANGER_META, POWER_META, REWARD_META, type LevelDef } from '../game/types';
import { cancelConnect, connect, disconnect, getWallet, signIn, useWallet } from '../lib/wallet';
import { shortAddress } from '../lib/phantom';

interface Props {
  onPlay: (level: number) => void;
  launching: number | null;
  error?: string | null;
}

type Tab = 'campaign' | 'profile' | 'help';

export function Menu({ onPlay, launching, error }: Props) {
  const progress = useProgress();
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>('campaign');
  const [walletBusy, setWalletBusy] = useState(false);

  const stars = totalStars(progress);
  const lifetime = progress.lifetime.points;
  const cleared = LEVELS.filter((l) => levelRecord(l.id, progress).cleared).length;
  const playable = Math.min(progress.unlocked, LAST_LEVEL);
  const focusLevel = levelById(playable);
  const nextObjective = nextLevelId(playable) ? goalLabel(focusLevel) : 'Final level';
  const connected = wallet.status === 'connected' && Boolean(wallet.address);
  const canPlay = connected && wallet.verified;

  const handleConnect = async () => {
    if (wallet.status === 'connecting') {
      cancelConnect();
      setWalletBusy(false);
      return;
    }
    if (walletBusy) return;
    setWalletBusy(true);
    try {
      if (connected) {
        await disconnect();
      } else {
        await connect();
        const current = getWallet();
        if (current.status === 'connected' && current.address) await signIn();
      }
    } finally {
      setWalletBusy(false);
    }
  };

  return (
    <div className="menu">
      <div className="menu-bg" aria-hidden="true">
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="grid-lines" />
      </div>

      <header className="topbar">
        <div className="brand">
          <img src="/digo/digo-logo.png" alt="" className="brand-mark" />
          <div>
            <strong>DIGO</strong>
            <span>EVOLUTION</span>
          </div>
        </div>

        <button
          type="button"
          className={`wallet-btn${connected ? ' is-on' : ''}`}
          onClick={handleConnect}
          disabled={walletBusy && wallet.status !== 'connecting'}
        >
          <Icon name="wallet" size={17} />
          <span className="wallet-label">
            {wallet.status === 'connecting'
              ? 'Cancel connection'
              : connected && wallet.address
                ? shortAddress(wallet.address)
                : 'Connect Phantom'}
          </span>
          {connected && <em className="mode-tag phantom">{wallet.verified ? 'VERIFIED' : 'VERIFY'}</em>}
        </button>
      </header>

      <section className="hero">
        <div className="hero-stage">
          <img src="/digo/digo-logo.png" alt="Official DIGO character" className="hero-logo" />
          <span className="hero-ring" aria-hidden="true" />
        </div>
        <h1 className="hero-title">
          DIGO <span>EVOLUTION</span>
        </h1>
        <p className="hero-sub">Run the lane. Bank the gold. Never touch a bomb.</p>
        <p className="mock-note">DIGO shown here is an in-game score only, not an on-chain token balance or withdrawable reward.</p>

        <div className="stat-row">
          <Stat icon="star" label="Stars" value={`${stars}/${LAST_LEVEL * 3}`} />
          <Stat icon="coin" label="DIGO" value={progress.digo.toLocaleString()} />
          <Stat icon="trophy" label="Lifetime" value={lifetime.toLocaleString()} />
        </div>

        {canPlay ? (
          <button
            type="button"
            className="btn primary xl"
            onClick={() => onPlay(playable)}
            disabled={launching !== null}
          >
            <Icon name="play" size={22} filled />
            {launching !== null ? 'Loading level…' : `Play Level ${playable}`}
            <span className="btn-sub">{nextObjective}</span>
          </button>
        ) : (
          <button type="button" className="btn primary xl" onClick={connected ? () => void signIn() : handleConnect} disabled={walletBusy || wallet.status === 'connecting'}>
            <Icon name={connected ? 'check' : 'wallet'} size={20} />
            {wallet.status === 'connecting' ? 'Cancel Phantom connection' : connected ? 'Verify Phantom wallet to start playing' : 'Connect your Phantom wallet to start playing DIGO'}
          </button>
        )}

        {wallet.error && <p className="error-note">{wallet.error}</p>}
        {error && <p className="error-note">{error}</p>}

        {!wallet.installed && !connected && (
          <p className="mock-note">
            Install Phantom, then connect your real Solana wallet. Test wallets are disabled in production.
          </p>
        )}
      </section>

      <nav className="tabs" aria-label="Sections">
        <TabButton active={tab === 'campaign'} icon="flag" label="Campaign" onClick={() => setTab('campaign')} />
        <TabButton active={tab === 'profile'} icon="user" label="Profile" onClick={() => setTab('profile')} />
        <TabButton active={tab === 'help'} icon="help" label="How to play" onClick={() => setTab('help')} />
      </nav>

      {tab === 'campaign' && (
        <Campaign progress={progress} onPlay={onPlay} locked={!canPlay} />
      )}
      {tab === 'profile' && <Profile progress={progress} cleared={cleared} stars={stars} />}
      {tab === 'help' && <HowToPlay />}

      <footer className="menu-footer">
        <span>Level {cleared} of {LAST_LEVEL} cleared</span>
        <span className="dot" />
        <span>DIGO points are game points, never tokens</span>
      </footer>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="stat">
      <Icon name={icon} size={16} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`tab${active ? ' is-active' : ''}`} onClick={onClick}>
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

function Campaign({
  progress,
  onPlay,
  locked,
}: {
  progress: Progress;
  onPlay: (level: number) => void;
  locked: boolean;
}) {
  return (
    <section className="panel campaign">
      {CHAPTERS.map((chapter) => {
        const clearedCount = chapter.levels.filter((l) => levelRecord(l.id, progress).cleared).length;
        const world = worldById(chapter.world);
        const first = chapter.levels[0].id;
        const last = chapter.levels[chapter.levels.length - 1].id;
        return (
          <div key={chapter.index} className="world-block">
            <header className="world-head" style={{ ['--accent' as string]: world.accent }}>
              <span className="world-swatch" />
              <div>
                <h3>
                  Chapter {chapter.index} · {chapter.name}
                </h3>
                <p>
                  Levels {first}–{last} · {clearedCount}/{chapter.levels.length} cleared · {world.name}
                </p>
              </div>
            </header>
            <div className="level-grid">
              {chapter.levels.map((level) => (
                <LevelCard
                  key={level.id}
                  level={level}
                  progress={progress}
                  locked={locked}
                  onPlay={onPlay}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function LevelCard({
  level,
  progress,
  locked,
  onPlay,
}: {
  level: LevelDef;
  progress: Progress;
  locked: boolean;
  onPlay: (level: number) => void;
}) {
  const record = levelRecord(level.id, progress);
  const unlocked = isUnlocked(level.id, progress);
  const world = worldById(level.world);
  const disabled = !unlocked || locked;

  return (
    <button
      type="button"
      className={`level-card${record.cleared ? ' is-cleared' : ''}${disabled ? ' is-locked' : ''}`}
      style={{ ['--accent' as string]: world.accent, ['--accent2' as string]: world.accent2 }}
      onClick={() => !disabled && onPlay(level.id)}
      disabled={disabled}
    >
      <div className="level-top">
        <span className="level-num">{level.id}</span>
        {unlocked ? (
          <span className="level-stars">
            {[0, 1, 2].map((i) => (
              <Icon key={i} name="star" size={13} filled={i < record.stars} className={i < record.stars ? 'on' : 'off'} />
            ))}
          </span>
        ) : (
          <Icon name="lock" size={15} />
        )}
      </div>
      <strong className="level-name">{level.name}</strong>
      <span className="level-goal">{goalLabel(level)}</span>
      <span className="level-meta">
        {record.best > 0 ? `Best ${record.best.toLocaleString()}` : `${level.bonus} bonus`}
      </span>
    </button>
  );
}

function Profile({ progress, cleared, stars }: { progress: Progress; cleared: number; stars: number }) {
  const earned = useMemo(() => new Set(progress.achievements), [progress.achievements]);
  const [draft, setDraft] = useState(progress.name);

  return (
    <section className="panel profile">
      <div className="profile-card">
        <label className="field">
          <span>Player name</span>
          <input
            value={draft}
            maxLength={18}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => setName(draft)}
            placeholder="Player"
          />
        </label>
        <div className="profile-stats">
          <div><strong>{cleared}/{LAST_LEVEL}</strong><span>Levels cleared</span></div>
          <div><strong>{stars}</strong><span>Stars earned</span></div>
          <div><strong>{progress.digo.toLocaleString()}</strong><span>DIGO collected</span></div>
        </div>
        <div className="profile-stats">
          <div><strong>{progress.lifetime.points.toLocaleString()}</strong><span>Lifetime points</span></div>
          <div><strong>{progress.lifetime.bonus.toLocaleString()}</strong><span>Completion bonuses</span></div>
          <div><strong>{progress.cyclesCompleted}</strong><span>Journeys finished</span></div>
        </div>
      </div>

      <h3 className="section-title">Achievements</h3>
      <ul className="achievement-list">
        {ACHIEVEMENTS.map((a) => (
          <li key={a.id} className={earned.has(a.id) ? 'is-earned' : ''}>
            <span className="ach-icon">
              <Icon name={a.icon as IconName} size={18} />
            </span>
            <div>
              <strong>{a.title}</strong>
              <p>{a.desc}</p>
            </div>
            {earned.has(a.id) ? <Icon name="check" size={16} /> : <Icon name="lock" size={14} />}
          </li>
        ))}
      </ul>

      <h3 className="section-title">Settings</h3>
      <div className="settings">
        <Slider
          label="Music"
          value={progress.settings.music}
          onChange={(v) => updateSettings({ music: v })}
        />
        <Slider
          label="Sound effects"
          value={progress.settings.sfx}
          onChange={(v) => updateSettings({ sfx: v })}
        />
        <div className="setting-row">
          <span>Graphics quality</span>
          <div className="segmented">
            {(['high', 'medium', 'low'] as const).map((q) => (
              <button
                key={q}
                type="button"
                className={progress.settings.quality === q ? 'is-on' : ''}
                onClick={() => updateSettings({ quality: q })}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span>Controls</span>
          <div className="segmented">
            {(['both', 'drag', 'buttons'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={progress.settings.control === c ? 'is-on' : ''}
                onClick={() => updateSettings({ control: c })}
              >
                {c === 'both' ? 'drag + buttons' : c}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span>Haptics</span>
          <button
            type="button"
            className={`switch${progress.settings.haptics ? ' is-on' : ''}`}
            onClick={() => updateSettings({ haptics: !progress.settings.haptics })}
            aria-pressed={progress.settings.haptics}
          >
            <span />
          </button>
        </div>
        <button type="button" className="btn ghost sm danger" onClick={() => resetProgress()}>
          Reset campaign progress
        </button>
      </div>
    </section>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="slider-row">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <em>{Math.round(value * 100)}%</em>
    </label>
  );
}

function HowToPlay() {
  return (
    <section className="panel help">
      <div className="help-block">
        <h3 className="section-title">Controls</h3>
        <ul className="bullets">
          <li><Icon name="arrowLeft" size={15} /> Hold and drag anywhere on the pad — DIGO follows your finger.</li>
          <li><Icon name="arrowRight" size={15} /> Or hold the left / right buttons. Arrow keys and A / D work too.</li>
          <li><Icon name="jump" size={15} /> Jump with the jump button, Space or W to clear low objects.</li>
          <li><Icon name="pause" size={15} /> Pause any time; your run resumes exactly where it stopped.</li>
        </ul>
      </div>

      <h3 className="section-title">Collect these</h3>
      <ul className="legend">
        {(Object.keys(REWARD_META) as Array<keyof typeof REWARD_META>).map((k) => (
          <li key={k} className="good">
            <span className="legend-icon"><Icon name={REWARD_META[k].icon as IconName} size={18} /></span>
            <div>
              <strong>{REWARD_META[k].label}</strong>
              <p>{REWARD_META[k].blurb}</p>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="section-title">Avoid these</h3>
      <ul className="legend">
        {(Object.keys(DANGER_META) as Array<keyof typeof DANGER_META>).map((k) => (
          <li key={k} className="bad">
            <span className="legend-icon"><Icon name={DANGER_META[k].icon as IconName} size={18} /></span>
            <div>
              <strong>{DANGER_META[k].label}</strong>
              <p>{DANGER_META[k].blurb}</p>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="section-title">Power-ups</h3>
      <ul className="legend">
        {(Object.keys(POWER_META) as Array<keyof typeof POWER_META>).map((k) => (
          <li key={k} className="power">
            <span className="legend-icon"><Icon name={POWER_META[k].icon as IconName} size={18} /></span>
            <div>
              <strong>{POWER_META[k].label}</strong>
              <p>{POWER_META[k].blurb}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="fineprint">
        Every level is timed and completable. Clearing a level banks its completion bonus plus all DIGO you
        collected. Stars are awarded from your level score.
      </p>
    </section>
  );
}
