import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DigoGame } from '../game/DigoGame';
import { levelById } from '../game/levels';
import { worldById } from '../game/worlds';
import {
  POWER_META,
  type HudState,
  type RunConfig,
  type RunResult,
} from '../game/types';
import { useProgress } from '../game/progress';
import type { FinishReport } from '../App';
import { Icon } from './icons';

interface Props {
  level: number;
  seed: number;
  onExit: () => void;
  onRetry: () => void;
  onNext: (level: number) => void;
  onFinish: (result: RunResult) => Promise<FinishReport>;
}

interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

export function GameScreen({ level, seed, onExit, onRetry, onNext, onFinish }: Props) {
  const progress = useProgress();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<DigoGame | null>(null);
  const toastId = useRef(0);

  const [hud, setHud] = useState<HudState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [report, setReport] = useState<FinishReport | null>(null);
  const [ready, setReady] = useState(false);

  const def = useMemo(() => levelById(level), [level]);
  const world = worldById(def.world);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const pushToast = useCallback((text: string, tone: Toast['tone']) => {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 1500);
  }, []);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    const config: RunConfig = {
      level: def,
      seed,
      musicVolume: progress.settings.music,
      sfxVolume: progress.settings.sfx,
      haptics: progress.settings.haptics,
      controlMode: progress.settings.control,
      quality: progress.settings.quality,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };

    const game = new DigoGame(host, config, (event) => {
      if (event.type === 'hud') setHud(event.hud);
      else if (event.type === 'toast') pushToast(event.text, event.tone);
      else if (event.type === 'ready') setReady(true);
      else if (event.type === 'over') {
        setResult(event.result);
        void finishRef.current(event.result).then(setReport);
      }
    });

    gameRef.current = game;
    game.attachPad(padRef.current);

    return () => {
      game.destroy();
      gameRef.current = null;
    };
    // The game is created once per mounted attempt; settings changes apply to the next run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, seed, pushToast]);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (!game || result) return;
    if (paused) {
      game.resume();
      setPaused(false);
    } else {
      game.pause();
      setPaused(true);
    }
  }, [paused, result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    };
    const onHide = () => {
      if (document.hidden && !paused && !result) {
        gameRef.current?.pause();
        setPaused(true);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [togglePause, paused, result]);

  const hold = (dir: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      gameRef.current?.setDirection(dir);
    },
    onPointerUp: () => gameRef.current?.setDirection(0),
    onPointerCancel: () => gameRef.current?.setDirection(0),
    onPointerLeave: () => gameRef.current?.setDirection(0),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const healthPct = hud ? Math.max(0, (hud.health / hud.maxHealth) * 100) : 100;
  const timeLeft = hud ? Math.max(0, Math.ceil(hud.timeLimit - hud.time)) : def.timeLimit;
  const goalPct = hud && hud.goal.target > 0 ? Math.min(100, (hud.goal.progress / hud.goal.target) * 100) : 0;
  const showPad = progress.settings.control !== 'buttons';
  const showButtons = progress.settings.control !== 'drag';

  return (
    <div className="game" style={{ ['--accent' as string]: world.accent, ['--accent2' as string]: world.accent2 }}>
      <div ref={mountRef} className="game-canvas" />

      <div className="hud">
        <div className="hud-top">
          <button type="button" className="icon-btn" onClick={togglePause} aria-label="Pause">
            <Icon name="pause" size={18} />
          </button>

          <div className="hud-level">
            <span className="hud-world">{world.name}</span>
            <strong>
              Level {def.id} · {def.name}
            </strong>
          </div>

          <div className={`hud-timer${timeLeft <= 10 ? ' is-low' : ''}`}>
            <Icon name="clock" size={15} />
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="hud-bars">
          <div className="bar health">
            <span style={{ width: `${healthPct}%` }} />
            <em>
              <Icon name="heart" size={12} /> {Math.round(hud?.health ?? 100)}
            </em>
          </div>
          <div className="bar goal">
            <span style={{ width: `${goalPct}%` }} />
            <em>{hud?.goal.label ?? def.objective}</em>
          </div>
        </div>

        <div className="hud-score">
          <strong>{(hud?.score ?? 0).toLocaleString()}</strong>
          <span>score</span>
        </div>

        <div className="hud-right">
          <div className="hud-digo">
            <Icon name="coin" size={15} />
            {(hud?.digo ?? 0).toLocaleString()}
          </div>
          <div className="hud-stars">
            {[0, 1, 2].map((i) => (
              <Icon key={i} name="star" size={14} filled={(hud?.stars ?? 0) > i} className={(hud?.stars ?? 0) > i ? 'on' : 'off'} />
            ))}
          </div>
          {hud && hud.multiplier > 1 && (
            <div className="hud-combo">
              x{hud.multiplier.toFixed(1)}
              {hud.combo > 1 && <em>{hud.combo} combo</em>}
            </div>
          )}
        </div>

        {hud && hud.powerups.length > 0 && (
          <div className="hud-powers">
            {hud.powerups.map((p) => (
              <div key={p.kind} className="power-chip" style={{ ['--p' as string]: POWER_META[p.kind].color }}>
                <Icon name={POWER_META[p.kind].icon as never} size={14} />
                <span>{POWER_META[p.kind].label}</span>
                <i style={{ width: `${(p.remaining / p.total) * 100}%` }} />
              </div>
            ))}
          </div>
        )}

        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.tone}`}>
              {t.text}
            </div>
          ))}
        </div>
      </div>

      <div className="controls">
        {showPad && <div ref={padRef} className="control-pad" aria-label="Drag to move DIGO" />}
        {showButtons && (
          <div className="control-buttons">
            <button type="button" className="ctl" aria-label="Move left" {...hold(-1)}>
              <Icon name="arrowLeft" size={26} />
            </button>
            <button
              type="button"
              className="ctl jump"
              aria-label="Jump"
              onPointerDown={(e) => {
                e.preventDefault();
                gameRef.current?.jump();
              }}
            >
              <Icon name="jump" size={24} />
            </button>
            <button type="button" className="ctl" aria-label="Move right" {...hold(1)}>
              <Icon name="arrowRight" size={26} />
            </button>
          </div>
        )}
        {showPad && !ready && <div className="pad-hint">Hold and drag to move · tap jump</div>}
      </div>

      {paused && !result && (
        <div className="overlay">
          <div className="sheet">
            <h2>Paused</h2>
            <p className="sheet-sub">
              Level {def.id} · {def.name}
            </p>
            <div className="sheet-actions">
              <button type="button" className="btn primary" onClick={togglePause}>
                <Icon name="play" size={18} filled /> Resume
              </button>
              <button type="button" className="btn ghost" onClick={onRetry}>
                <Icon name="retry" size={18} /> Restart
              </button>
              <button type="button" className="btn ghost" onClick={onExit}>
                <Icon name="home" size={18} /> Main menu
              </button>
            </div>
            <p className="fineprint">{def.objective}</p>
          </div>
        </div>
      )}

      {result && (
        <ResultSheet
          result={result}
          report={report}
          level={level}
          onRetry={onRetry}
          onExit={onExit}
          onNext={onNext}
        />
      )}
    </div>
  );
}

function ResultSheet({
  result,
  report,
  level,
  onRetry,
  onExit,
  onNext,
}: {
  result: RunResult;
  report: FinishReport | null;
  level: number;
  onRetry: () => void;
  onExit: () => void;
  onNext: (level: number) => void;
}) {
  const next = level + 1;
  const canNext = result.victory && next <= 12;

  return (
    <div className="overlay">
      <div className={`sheet result${result.victory ? ' win' : ' lose'}`}>
        <div className="result-badge">
          <Icon name={result.victory ? 'trophy' : 'heart' } size={26} />
        </div>
        <h2>{result.victory ? 'Level Complete' : 'Run Over'}</h2>
        <p className="sheet-sub">{result.reason}</p>

        <div className="result-stars">
          {[0, 1, 2].map((i) => (
            <Icon key={i} name="star" size={30} filled={i < result.stars} className={i < result.stars ? 'on' : 'off'} />
          ))}
        </div>

        <dl className="result-rows">
          <div>
            <dt>Level score</dt>
            <dd>{result.score.toLocaleString()}</dd>
          </div>
          <div>
            <dt>DIGO collected</dt>
            <dd>
              <Icon name="coin" size={13} /> {result.digo.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt>Completion bonus</dt>
            <dd className={result.bonus > 0 ? 'gold' : ''}>{result.bonus > 0 ? `+${result.bonus}` : '—'}</dd>
          </div>
          <div className="total">
            <dt>Total earned</dt>
            <dd>{result.total.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Best combo</dt>
            <dd>x{Math.max(1, result.maxCombo)}</dd>
          </div>
          <div>
            <dt>Objects dodged</dt>
            <dd>{result.dodged}</dd>
          </div>
        </dl>

        {report?.newBest && <p className="pill good">New level best!</p>}
        {report?.unlockedNext && (
          <p className="pill info">Level {report.unlockedNext} unlocked</p>
        )}
        {report?.newAchievements.map((a) => (
          <p key={a.id} className="pill gold">
            <Icon name="trophy" size={13} /> {a.title}
          </p>
        ))}
        {report?.verdict && (
          <p className={`verdict${report.verified ? ' ok' : ''}`}>
            <Icon name={report.verified ? 'check' : 'info'} size={13} /> {report.verdict}
          </p>
        )}

        <div className="sheet-actions">
          {canNext && (
            <button type="button" className="btn primary" onClick={() => onNext(next)}>
              <Icon name="next" size={18} /> Next level
            </button>
          )}
          <button type="button" className={`btn ${canNext ? 'ghost' : 'primary'}`} onClick={onRetry}>
            <Icon name="retry" size={18} /> Retry level {level}
          </button>
          <button type="button" className="btn ghost" onClick={onExit}>
            <Icon name="home" size={18} /> Main menu
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
