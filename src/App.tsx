import { useCallback, useEffect, useState } from 'react';
import { Menu } from './ui/Menu';
import { GameScreen } from './ui/GameScreen';
import { initWallet, useWallet } from './lib/wallet';
import { loadProgress, recordRun, startNewJourney } from './game/progress';
import { startRun, submitRun } from './lib/api';
import type { Achievement } from './game/progress';
import type { RunResult } from './game/types';

export interface FinishReport {
  newBest: boolean;
  unlockedNext: number | null;
  newAchievements: Achievement[];
  verdict: string | null;
  verified: boolean;
  /** Completion bonus paid for this run. */
  bonus: number;
  /** Points awarded for achievements unlocked by this run. */
  achievementPoints: number;
  /** True on the run that clears level 100 for the current journey. */
  campaignComplete: boolean;
  cyclesCompleted: number;
  lifetimePoints: number;
  lifetimeDigo: number;
  lifetimeBonus: number;
  levelsCleared: number;
}

type Route =
  | { name: 'menu' }
  | { name: 'game'; level: number; seed: number; token: string | null; attempt: number };

let booted = false;

export function App() {
  const wallet = useWallet();
  const [route, setRoute] = useState<Route>({ name: 'menu' });
  const [launching, setLaunching] = useState<number | null>(null);

  // Load the save file and detect Phantom once, before the first paint settles.
  useEffect(() => {
    if (booted) return;
    booted = true;
    loadProgress();
    initWallet();
  }, []);

  const launch = useCallback(async (level: number) => {
    setLaunching(level);
    let seed = Math.floor(Math.random() * 2 ** 31);
    let token: string | null = null;
    try {
      const ticket = await startRun(level);
      seed = ticket.seed;
      token = ticket.token;
    } catch {
      // Offline or API unavailable: the level still plays with a local seed.
    }
    setLaunching(null);
    setRoute({ name: 'game', level, seed, token, attempt: 0 });
  }, []);

  const finish = useCallback(
    async (result: RunResult): Promise<FinishReport> => {
      const outcome = recordRun(result);
      const current = route;
      let verdict: string | null = null;
      let verified = false;
      if (current.name === 'game' && current.token) {
        try {
          const res = await submitRun(current.token, result, 'DIGO Player', wallet.address);
          verified = Boolean(res.accepted);
          verdict = res.accepted
            ? `Server verified${res.rank ? ` · rank #${res.rank}` : ''}`
            : res.reason ?? 'Run not verified';
        } catch {
          verdict = 'Score saved locally (server unavailable)';
        }
      } else {
        verdict = 'Score saved locally';
      }
      return {
        newBest: outcome.newBest,
        unlockedNext: outcome.unlockedNext,
        newAchievements: outcome.newAchievements,
        verdict,
        verified,
        bonus: outcome.bonus,
        achievementPoints: outcome.achievementPoints,
        campaignComplete: outcome.campaignComplete,
        cyclesCompleted: outcome.cyclesCompleted,
        lifetimePoints: outcome.lifetimePoints,
        lifetimeDigo: outcome.lifetimeDigo,
        lifetimeBonus: outcome.lifetimeBonus,
        levelsCleared: outcome.levelsCleared,
      };
    },
    [route, wallet.address],
  );

  if (route.name === 'game') {
    return (
      <GameScreen
        key={`${route.level}-${route.seed}-${route.attempt}`}
        level={route.level}
        seed={route.seed}
        onExit={() => setRoute({ name: 'menu' })}
        onRetry={() =>
          setRoute({
            ...route,
            attempt: route.attempt + 1,
            seed: Math.floor(Math.random() * 2 ** 31),
          })
        }
        onNext={(level) => void launch(level)}
        onNewJourney={() => {
          // Restarts the campaign at level 1; lifetime points, DIGO and
          // achievements stay untouched.
          startNewJourney();
          void launch(1);
        }}
        onFinish={finish}
      />
    );
  }

  return <Menu onPlay={(level) => void launch(level)} launching={launching} />;
}

export default App;
