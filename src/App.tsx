import { useCallback, useEffect, useState } from 'react';
import { loadProfile, resetProfile, saveProfile, type Profile, type RunApplication } from './game/progression';
import { dailySeed } from './game/modes';
import type { ModeId, RunConfig, RunResult, WorldId } from './game/types';
import GameScreen from './ui/GameScreen';
import { CharacterSelect, Codex, MainMenu, ModeSelect, WorldSelect, type Screen } from './ui/Menu';
import { AchievementsView, LeaderboardView, MissionsView, ProfileView } from './ui/Progress';
import SettingsView from './ui/SettingsView';

export default function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [screen, setScreen] = useState<Screen>('menu');
  const [world, setWorld] = useState<WorldId>('island');
  const [config, setConfig] = useState<RunConfig | null>(null);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const play = useCallback(
    (mode: ModeId) => {
      const activeWorld: WorldId = profile.unlockedWorlds.includes(world) ? world : 'island';
      setConfig({
        world: activeWorld,
        mode,
        stage: profile.stage,
        seed: mode === 'daily' ? dailySeed() : (Math.random() * 2 ** 31) | 0,
        musicVolume: profile.settings.music,
        sfxVolume: profile.settings.sfx,
        haptics: profile.settings.haptics,
        controlMode: profile.settings.controls,
      });
      setScreen('game');
    },
    [profile, world],
  );

  const finishRun = useCallback((app: RunApplication, _result: RunResult) => {
    setProfile(app.profile);
  }, []);

  const patchSettings = useCallback((patch: Partial<Profile['settings']>) => {
    setProfile((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  }, []);

  if (screen === 'game' && config) {
    return (
      <GameScreen
        profile={profile}
        config={config}
        onFinish={finishRun}
        onSettingsChange={patchSettings}
        onExit={() => {
          setConfig(null);
          setScreen('menu');
        }}
      />
    );
  }

  switch (screen) {
    case 'modes':
      return <ModeSelect profile={profile} onBack={() => setScreen('menu')} onPlay={play} />;
    case 'worlds':
      return (
        <WorldSelect
          profile={profile}
          selected={world}
          onBack={() => setScreen('menu')}
          onSelect={(w) => {
            setWorld(w);
            setScreen('menu');
          }}
        />
      );
    case 'character':
      return (
        <CharacterSelect
          profile={profile}
          onBack={() => setScreen('menu')}
          onSelect={(stage) => setProfile((p) => ({ ...p, stage }))}
        />
      );
    case 'missions':
      return <MissionsView profile={profile} onBack={() => setScreen('menu')} />;
    case 'achievements':
      return <AchievementsView profile={profile} onBack={() => setScreen('menu')} />;
    case 'leaderboard':
      return <LeaderboardView onBack={() => setScreen('menu')} />;
    case 'profile':
      return <ProfileView profile={profile} onBack={() => setScreen('menu')} />;
    case 'codex':
      return <Codex onBack={() => setScreen('menu')} />;
    case 'settings':
      return (
        <SettingsView
          profile={profile}
          onBack={() => setScreen('menu')}
          onSettings={patchSettings}
          onName={(name) => setProfile((p) => ({ ...p, name }))}
          onWallet={(address, verified) =>
            setProfile((p) => ({ ...p, wallet: { address, linkedAt: address ? Date.now() : null, verified } }))
          }
          onReset={() => setProfile(resetProfile())}
        />
      );
    default:
      return <MainMenu profile={profile} world={world} onPlay={() => play('endless')} onNav={setScreen} />;
  }
}
