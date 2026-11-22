import { useCallback, useEffect, useRef, useState } from 'react';
import { DigoGame } from '../game/DigoGame';
import type { GameEvent, HudState, RunConfig, RunResult } from '../game/types';
import { applyRunResult, stageDef, STAGES, type Profile, type RunApplication } from '../game/progression';
import { dailyKey } from '../game/modes';
import { WORLD_MAP } from '../game/worlds';
import { startRun, submitRun } from '../lib/api';

interface Props {
  profile: Profile;
  config: RunConfig;
  onFinish: (app: RunApplication, result: RunResult) => void;
  onExit: () => void;
  onSettingsChange: (patch: Partial<Profile['settings']>) => void;
}

interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

const EMPTY_HUD: HudState = {
  status: 'running',
  score: 0,
  combo: 0,
  multiplier: 1,
  health: 100,
  maxHealth: 100,
  lives: 3,
  maxLives: 3,
  level: 1,
  time: 0,
  world: 'island',
  mode: 'endless',
  stage: 1,
  powerups: [],
  boss: null,
  objective: null,
  coins: 0,
  shield: false,
};

export default function GameScreen({ profile, config, onFinish, onExit, onSettingsChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<DigoGame | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const [runKey, setRunKey] = useState(0);
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [application, setApplication] = useState<RunApplication | null>(null);
  const [verdict, setVerdict] = useState<string>('Validating run…');
  const [phase, setPhase] = useState<'loading' | 'playing' | 'paused' | 'over'>('loading');
  const [hint, setHint] = useState(true);
  const toastId = useRef(0);

  const pushToast = useCallback((text: string, tone: Toast['tone']) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 1400);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const pad = padRef.current;
    if (!container || !pad) return;

    let disposed = false;
    let game: DigoGame | null = null;
    let token: string | null = null;

    const handleEvent = (event: GameEvent) => {
      if (disposed) return;
      if (event.type === 'hud') {
        setHud(event.hud);
        if (event.hud.status === 'paused') setPhase('paused');
        else if (event.hud.status === 'running') setPhase((p) => (p === 'over' ? p : 'playing'));
        return;
      }
      if (event.type === 'toast') {
        pushToast(event.text, event.tone);
        return;
      }
      if (event.type === 'ready') {
        setPhase('playing');
        return;
      }
      if (event.type === 'over') {
        const app = applyRunResult(profileRef.current, event.result, dailyKey());
        setResult(event.result);
        setApplication(app);
        setPhase('over');
        onFinish(app, event.result);
        if (token) {
          submitRun(token, event.result, profileRef.current.name, profileRef.current.wallet.address)
            .then((v) =>
              setVerdict(
                v.accepted
                  ? `Server-verified · rank #${v.rank ?? '—'} · ${v.points ?? 0} pts`
                  : `Run rejected: ${v.reason ?? 'invalid'}`,
              ),
            )
            .catch(() => setVerdict('Offline run · saved locally only'));
        } else {
          setVerdict('Offline run · saved locally only');
        }
      }
    };

    (async () => {
      let seed = Math.floor(Math.random() * 2_000_000_000);
      try {
        const ticket = await startRun(config.world, config.mode, config.stage);
        seed = ticket.seed;
        token = ticket.token;
      } catch {
        token = null;
      }
      if (disposed) return;
      try {
        game = new DigoGame(container, { ...config, seed }, handleEvent);
        gameRef.current = game;
        game.input.attach(pad);
      } catch (err) {
        console.error('Failed to start DIGO engine', err);
        pushToast('Could not start renderer', 'bad');
      }
    })();

    const hintTimer = window.setTimeout(() => setHint(false), 6500);

    return () => {
      disposed = true;
      window.clearTimeout(hintTimer);
      game?.dispose();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, config.world, config.mode, config.stage]);

  const restart = () => {
    setResult(null);
    setApplication(null);
    setVerdict('Validating run…');
    setHud(EMPTY_HUD);
    setPhase('loading');
    setRunKey((k) => k + 1);
  };

  const togglePause = () => {
    const game = gameRef.current;
    if (!game) return;
    if (phase === 'paused') {
      game.resume();
      setPhase('playing');
    } else if (phase === 'playing') {
      game.pause();
      setPhase('paused');
    }
  };

  useEffect(() => {
    gameRef.current?.setVolumes(profile.settings.music, profile.settings.sfx);
  }, [profile.settings.music, profile.settings.sfx]);

  const stage = stageDef(profile.stage);
  const healthPct = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));

  return (
    <div className="game-root">
      <div className="game-canvas" ref={containerRef} />

      {/* ---------------- HUD ---------------- */}
      <div className="hud">
        <div className="hud-top">
          <div className="hud-score">
            <span className="hud-score-value">{hud.score.toLocaleString()}</span>
            <span className="hud-score-label">SCORE</span>
          </div>
          <div className="hud-mid">
            <div className="hud-chip">{hud.mode === 'time' ? `${Math.max(0, Math.ceil(90 - hud.time))}s` : `${Math.floor(hud.time)}s`}</div>
            <div className={`hud-chip combo ${hud.combo > 1 ? 'hot' : ''}`}>x{hud.multiplier.toFixed(1)}</div>
          </div>
          <button className="icon-btn" aria-label="Pause" onClick={togglePause}>
            {phase === 'paused' ? '▶' : '❚❚'}
          </button>
        </div>

        <div className="hud-bars">
          <div className="bar health">
            <div className="bar-fill" style={{ width: `${healthPct}%` }} />
            <span className="bar-text">{Math.round(hud.health)} HP</span>
          </div>
          <div className="lives">
            {Array.from({ length: hud.maxLives }).map((_, i) => (
              <span key={i} className={`life ${i < hud.lives ? 'on' : 'off'}`}>
                ♥
              </span>
            ))}
          </div>
        </div>

        <div className="hud-sub">
          <span className="pill">{WORLD_MAP[hud.world]?.name ?? 'World'}</span>
          <span className="pill">{stage.name}</span>
          <span className="pill">Lv {hud.level}</span>
          <span className="pill gold">🪙 {hud.coins}</span>
          {hud.shield && <span className="pill shield">🛡 Shield</span>}
        </div>

        {hud.objective && (
          <div className="objective">
            <span>{hud.objective.label}</span>
            <div className="objective-bar">
              <div
                className="objective-fill"
                style={{
                  width: `${Math.min(100, (hud.objective.progress / hud.objective.target) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {hud.boss && (
          <div className="boss-bar">
            <span className="boss-name">👹 {hud.boss.name}</span>
            <div className="bar boss">
              <div
                className="bar-fill"
                style={{ width: `${Math.max(0, (hud.boss.hp / hud.boss.max) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="powerups">
          {hud.powerups.map((p) => (
            <div key={p.kind} className="power-chip">
              <span>{powerIcon(p.kind)}</span>
              <i style={{ width: `${(p.remaining / p.total) * 100}%` }} />
            </div>
          ))}
        </div>

        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.tone}`}>
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- Controls ---------------- */}
      <div className="controls">
        {hint && phase === 'playing' && (
          <div className="hint">HOLD &amp; DRAG anywhere in this area to move DIGO</div>
        )}
        <div className="pad" ref={padRef} data-testid="touch-pad">
          <div className="pad-track">
            <span className="pad-arrow left">◀</span>
            <span className="pad-hint">HOLD &amp; DRAG</span>
            <span className="pad-arrow right">▶</span>
          </div>
          <div className="pad-knob" />
        </div>
        {profile.settings.controls !== 'drag' && (
          <div className="pad-buttons">
            <button
              className="pad-btn"
              aria-label="Move left"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                gameRef.current?.input.setButton('left', true);
              }}
              onPointerUp={() => gameRef.current?.input.setButton('left', false)}
              onPointerCancel={() => gameRef.current?.input.setButton('left', false)}
              onPointerLeave={() => gameRef.current?.input.setButton('left', false)}
            >
              ◀
            </button>
            <button
              className="pad-btn"
              aria-label="Move right"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                gameRef.current?.input.setButton('right', true);
              }}
              onPointerUp={() => gameRef.current?.input.setButton('right', false)}
              onPointerCancel={() => gameRef.current?.input.setButton('right', false)}
              onPointerLeave={() => gameRef.current?.input.setButton('right', false)}
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* ---------------- Pause ---------------- */}
      {phase === 'paused' && (
        <div className="overlay">
          <div className="panel">
            <h2>Paused</h2>
            <p className="muted">DIGO is holding position.</p>
            <button className="btn primary" onClick={togglePause}>
              Resume
            </button>
            <button className="btn" onClick={restart}>
              Restart run
            </button>
            <label className="slider">
              <span>Music</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={profile.settings.music}
                onChange={(e) => onSettingsChange({ music: Number(e.target.value) })}
              />
            </label>
            <label className="slider">
              <span>Sound FX</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={profile.settings.sfx}
                onChange={(e) => onSettingsChange({ sfx: Number(e.target.value) })}
              />
            </label>
            <button className="btn ghost" onClick={onExit}>
              Quit to menu
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Game over ---------------- */}
      {phase === 'over' && result && application && (
        <div className="overlay">
          <div className="panel result-panel">
            <h2 className={result.victory ? 'win' : 'lose'}>
              {result.victory ? 'Victory!' : 'Defeat'}
            </h2>
            <p className="muted">{result.reason}</p>
            <div className="result-score">{result.score.toLocaleString()}</div>
            <div className="result-grid">
              <div>
                <span>🪙 Coins</span>
                <b>+{result.coins}</b>
              </div>
              <div>
                <span>✨ XP</span>
                <b>+{result.xp}</b>
              </div>
              <div>
                <span>🔥 Max combo</span>
                <b>x{result.maxCombo}</b>
              </div>
              <div>
                <span>⏱ Survived</span>
                <b>{Math.floor(result.elapsed)}s</b>
              </div>
            </div>
            {application.isBest && <div className="badge best">New personal best!</div>}
            {application.levelsGained > 0 && (
              <div className="badge level">Level up ×{application.levelsGained}</div>
            )}
            {application.newStage !== null && (
              <div className="badge evolve">
                Evolution unlocked: {STAGES.find((s) => s.index === application.newStage)?.name}
              </div>
            )}
            {application.newWorlds.map((w) => (
              <div key={w} className="badge world">
                World unlocked: {WORLD_MAP[w].name}
              </div>
            ))}
            {application.completedMissions.map((m) => (
              <div key={m.id} className="badge mission">
                Mission complete: {m.title} (+{m.rewardCoins} 🪙)
              </div>
            ))}
            <div className="verdict">{verdict}</div>
            <button className="btn primary" onClick={restart}>
              Play again
            </button>
            <button className="btn ghost" onClick={onExit}>
              Main menu
            </button>
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div className="overlay">
          <div className="panel">
            <h2>Loading {WORLD_MAP[config.world].name}</h2>
            <p className="muted">Warming up the arena…</p>
            <div className="spinner" />
          </div>
        </div>
      )}
    </div>
  );
}

function powerIcon(kind: string): string {
  switch (kind) {
    case 'shield':
      return '🛡';
    case 'magnet':
      return '🧲';
    case 'slow':
      return '🐌';
    case 'double':
      return '✖2';
    case 'speed':
      return '⚡';
    case 'invincible':
      return '✨';
    default:
      return '★';
  }
}
