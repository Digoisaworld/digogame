import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu } from './ui/Menu';
import { GameScreen } from './ui/GameScreen';
import { initWallet, useWallet } from './lib/wallet';
import { getProgress, loadProgress, recordRun, replaceProgressFromServer, resetProgress, startNewJourney } from './game/progress';
import { fetchPlayerProgress, savePlayerProgress, startRun, submitRun } from './lib/api';
import type { Achievement } from './game/progress';
import type { RunResult } from './game/types';

export interface FinishReport {
  newBest: boolean;
  unlockedNext: number | null;
  newAchievements: Achievement[];
  verdict: string | null;
  verified: boolean;
  bonus: number;
  achievementPoints: number;
  campaignComplete: boolean;
  cyclesCompleted: number;
  lifetimePoints: number;
  lifetimeDigo: number;
  lifetimeBonus: number;
  levelsCleared: number;
}

type Route =
  | { name: 'menu' }
  | { name: 'game'; level: number; seed: number; token: string; attempt: number };

let booted = false;

export function App() {
  const wallet = useWallet();
  const [route, setRoute] = useState<Route>({ name: 'menu' });
  const [launching, setLaunching] = useState<number | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const progressRevision = useRef(0);

  useEffect(() => {
    if (booted) return;
    booted = true;
    loadProgress();
    initWallet();
  }, []);

  // The account's durable campaign is loaded only after the backend has
  // verified the wallet. Legacy local test progress is not promoted to rewards.
  useEffect(() => {
    if (!wallet.verified || !wallet.address) {
      setProgressReady(false);
      progressRevision.current = 0;
      return;
    }
    let active = true;
    setProgressReady(false);
    setLaunchError(null);
    void (async () => {
      const remote = await fetchPlayerProgress();
      if (!active) return;
      if (remote.progress) {
        replaceProgressFromServer(remote.progress);
        progressRevision.current = remote.revision;
      } else {
        resetProgress();
        const saved = await savePlayerProgress(getProgress(), 0);
        progressRevision.current = saved.revision;
      }
      if (active) setProgressReady(true);
    })().catch((error: unknown) => {
      if (!active) return;
      setLaunchError(error instanceof Error ? error.message : 'Could not load your account data.');
      setProgressReady(false);
    });
    return () => { active = false; };
  }, [wallet.verified, wallet.address]);

  const launch = useCallback(async (level: number) => {
    if (!wallet.verified) {
      setLaunchError('Connect and verify your real Phantom wallet before playing.');
      return;
    }
    if (!progressReady) {
      setLaunchError('Your account data is still syncing. Please wait a moment and try again.');
      return;
    }
    setLaunching(level);
    setLaunchError(null);
    try {
      const ticket = await startRun(level);
      setRoute({ name: 'game', level, seed: ticket.seed, token: ticket.token, attempt: 0 });
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'The game server could not start a verified run.');
    } finally {
      setLaunching(null);
    }
  }, [wallet.verified, progressReady]);

  const finish = useCallback(
    async (result: RunResult): Promise<FinishReport> => {
      const current = route;
      let verdict: string | null = null;
      let verified = false;
      let outcome: ReturnType<typeof recordRun> | null = null;
      if (current.name === 'game' && wallet.verified) {
        try {
          const res = await submitRun(current.token, result, getProgress().name);
          verified = Boolean(res.accepted && res.verified);
          if (verified) {
            outcome = recordRun(result);
            const saved = await savePlayerProgress(getProgress(), progressRevision.current);
            progressRevision.current = saved.revision;
            verdict = `Server verified${res.rank ? ` · rank #${res.rank}` : ''}`;
          } else {
            verdict = res.reason ?? 'The server rejected this run. No progress was awarded.';
          }
        } catch (error) {
          verdict = error instanceof Error
            ? `Server verification failed: ${error.message}. No progress was awarded.`
            : 'Server verification failed. No progress was awarded.';
        }
      } else {
        verdict = 'Wallet session missing. No progress was awarded.';
      }

      return {
        newBest: outcome?.newBest ?? false,
        unlockedNext: outcome?.unlockedNext ?? null,
        newAchievements: outcome?.newAchievements ?? [],
        verdict,
        verified,
        bonus: outcome?.bonus ?? 0,
        achievementPoints: outcome?.achievementPoints ?? 0,
        campaignComplete: outcome?.campaignComplete ?? false,
        cyclesCompleted: outcome?.cyclesCompleted ?? getProgress().cyclesCompleted,
        lifetimePoints: outcome?.lifetimePoints ?? getProgress().lifetime.points,
        lifetimeDigo: outcome?.lifetimeDigo ?? getProgress().lifetime.digo,
        lifetimeBonus: outcome?.lifetimeBonus ?? getProgress().lifetime.bonus,
        levelsCleared: outcome?.levelsCleared ?? Object.values(getProgress().levels).filter((entry) => entry.cleared).length,
      };
    },
    [route, wallet.verified],
  );

  if (route.name === 'game') {
    return (
      <GameScreen
        key={`${route.level}-${route.seed}-${route.attempt}`}
        level={route.level}
        seed={route.seed}
        onExit={() => setRoute({ name: 'menu' })}
        onRetry={() => void launch(route.level)}
        onNext={(level) => void launch(level)}
        onNewJourney={() => {
          startNewJourney();
          void savePlayerProgress(getProgress(), progressRevision.current)
            .then((saved) => { progressRevision.current = saved.revision; })
            .then(() => launch(1))
            .catch((error: unknown) => setLaunchError(error instanceof Error ? error.message : 'Could not save campaign progress.'));
        }}
        onFinish={finish}
      />
    );
  }

  return <Menu onPlay={(level) => void launch(level)} launching={launching} error={launchError} />;
}

export default App;
