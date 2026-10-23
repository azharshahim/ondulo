// ─── Serpent Puzzle : racine de l'application ──────────────────────────────
// Navigation simple par état (Accueil / Niveaux / Jeu / Réglages), chargement
// et sauvegarde automatique de la progression et des réglages (AsyncStorage),
// synchronisation de l'audio (sons + musique) avec les réglages.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Background from './src/ui/Background';
import { THEMES } from './src/ui/theme';
import HomeScreen from './src/screens/HomeScreen';
import LevelMapScreen from './src/screens/LevelMapScreen';
import GameScreen from './src/screens/GameScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { STRINGS } from './src/state/i18n';
import {
  loadProgress, loadSettings, saveProgress, saveSettings, totalStars,
  type Progress, type Settings,
} from './src/state/storage';
import { todayKey, TOTAL_LEVELS } from './src/levels/levels';
import { sound } from './src/audio/sound';

type Route =
  | { name: 'home' }
  | { name: 'levels' }
  | { name: 'settings' }
  | { name: 'game'; levelNumber: number | null }; // null = défi quotidien

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  // Chargement initial de la sauvegarde.
  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([loadSettings(), loadProgress()]);
      setSettings(s);
      setProgress(p);
    })();
  }, []);

  // L'audio suit les réglages en permanence.
  useEffect(() => {
    if (!settings) return;
    sound.soundEnabled = settings.sound;
    sound.musicEnabled = settings.music;
    sound.syncMusic();
  }, [settings]);

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      // Si le skin choisi n'est plus déblocable, on garde quand même le choix
      // (les étoiles ne diminuent jamais en pratique).
      void saveSettings(next);
      return next;
    });
  }, []);

  const handleComplete = useCallback((levelNumber: number | null) => (stars: number, isDaily: boolean) => {
    setProgress((prev) => {
      if (!prev) return prev;
      const next: Progress = {
        stars: { ...prev.stars },
        daily: { ...prev.daily },
        unlocked: prev.unlocked,
      };
      if (isDaily) {
        const key = todayKey();
        next.daily[key] = Math.max(next.daily[key] ?? 0, stars);
      } else if (levelNumber !== null) {
        const key = String(levelNumber);
        next.stars[key] = Math.max(next.stars[key] ?? 0, stars);
        next.unlocked = Math.max(next.unlocked, Math.min(TOTAL_LEVELS, levelNumber + 1));
      }
      void saveProgress(next);
      return next;
    });
  }, []);

  const theme = useMemo(
    () => THEMES[settings?.theme ?? 'sombre'],
    [settings?.theme],
  );
  const t = STRINGS[settings?.lang ?? 'fr'];
  const stars = progress ? totalStars(progress) : 0;
  const dailyDone = !!progress?.daily[todayKey()];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <Background theme={theme}>
          {!settings || !progress ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={theme.accent2} />
            </View>
          ) : route.name === 'home' ? (
            <HomeScreen
              theme={theme}
              t={t}
              currentLevel={Math.min(progress.unlocked, TOTAL_LEVELS)}
              totalStars={stars}
              dailyDone={dailyDone}
              onPlay={() => setRoute({ name: 'game', levelNumber: Math.min(progress.unlocked, TOTAL_LEVELS) })}
              onLevels={() => setRoute({ name: 'levels' })}
              onDaily={() => setRoute({ name: 'game', levelNumber: null })}
              onSettings={() => setRoute({ name: 'settings' })}
            />
          ) : route.name === 'levels' ? (
            <LevelMapScreen
              theme={theme}
              t={t}
              progress={progress}
              dailyDone={dailyDone}
              onSelect={(n) => setRoute({ name: 'game', levelNumber: n })}
              onDaily={() => setRoute({ name: 'game', levelNumber: null })}
              onBack={() => setRoute({ name: 'home' })}
            />
          ) : route.name === 'settings' ? (
            <SettingsScreen
              theme={theme}
              t={t}
              settings={settings}
              totalStars={stars}
              onChange={patchSettings}
              onBack={() => setRoute({ name: 'home' })}
            />
          ) : (
            <GameScreen
              key={`game-${route.levelNumber ?? 'daily'}`}
              levelNumber={route.levelNumber}
              settings={settings}
              theme={theme}
              t={t}
              onExitHome={() => setRoute({ name: 'home' })}
              onOpenLevels={() => setRoute({ name: 'levels' })}
              onComplete={handleComplete(route.levelNumber)}
              onNextLevel={() =>
                setRoute({
                  name: 'game',
                  levelNumber: Math.min(TOTAL_LEVELS, (route.levelNumber ?? 1) + 1),
                })
              }
            />
          )}
        </Background>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
