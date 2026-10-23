// ─── Ondulo : racine de l'application ────────────────────────────────────
// Navigation simple par état (Accueil / Niveaux / Jeu / Réglages), chargement
// et sauvegarde automatique de la progression et des réglages (AsyncStorage),
// synchronisation de l'audio (sons + musique) avec les réglages.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Background from './src/ui/Background';
import { THEMES } from './src/ui/theme';
import HomeScreen from './src/screens/HomeScreen';
import LevelMapScreen from './src/screens/LevelMapScreen';
import GameScreen from './src/screens/GameScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import {
  loadLang, loadDict, isRTL, type Lang, type Dict,
} from './src/i18n';
import {
  loadProgress, loadSettings, saveProgress, saveSettings, totalStars,
  type Progress, type Settings,
} from './src/state/storage';
import { todayKey, TOTAL_LEVELS } from './src/levels/levels';
import { sound } from './src/audio/sound';

/** Variable de module pour la langue activée (chargement asynchrone). */
let _langCached: Lang | null = null;
function loadLangCached(): Lang {
  return _langCached ?? 'en';
}

type Route =
  | { name: 'home' }
  | { name: 'levels' }
  | { name: 'settings' }
  | { name: 'game'; levelNumber: number | null }; // null = défi quotidien

/**
 * Durcissement de la page web mobile (injecté une seule fois) :
 *  • html/body : overflow hidden, overscroll-behavior none (plus de
 *    pull-to-refresh ni de défilement de la page) ;
 *  • hauteur 100dvh (et non 100vh) : la hauteur ne bouge plus quand la
 *    barre d'adresse du navigateur se réduit ;
 *  • viewport : zoom par pincement désactivé pendant le jeu ;
 *  • tap highlight transparent.
 */
function installWebFixes() {
  if (Platform.OS !== 'web') return;
  const doc = (globalThis as { document?: Document }).document;
  if (!doc || doc.getElementById('ondulo-web-fix')) return;
  const style = doc.createElement('style');
  style.id = 'ondulo-web-fix';
  style.textContent = [
    'html, body { height: 100dvh; overflow: hidden; overscroll-behavior: none; }',
    'body { position: fixed; inset: 0; width: 100%; }',
    '#root { height: 100dvh; }',
    '* { -webkit-tap-highlight-color: transparent; }',
  ].join('\n');
  doc.head.appendChild(style);
  const meta = doc.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
    );
  }
  // Détection du mode clair/sombre du système (web) : expose __onduloNight.
  try {
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const update = () => { (globalThis as { __onduloNight?: boolean }).__onduloNight = mq.matches; };
      update();
      mq.addEventListener?.('change', update);
    }
  } catch { /* ignore */ }
}

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [dict, setDict] = useState<Dict>({});

  // Verrouillage de la page web (défilement, zoom, hauteur dynamique).
  useEffect(() => { installWebFixes(); }, []);

  // Chargement initial : langue (détection automatique, repli anglais),
  // dictionnaire de traduction (JSON) et sauvegarde.
  useEffect(() => {
    (async () => {
      const [lang, s, p] = await Promise.all([loadLang(), loadSettings(), loadProgress()]);
      setLang(lang);
      const dict = await loadDict(lang);
      setDict(dict);
      setSettings(s);
      setProgress(p);
    })();
  }, []);

  // Direction RTL (arabe) sur le web : injecte dir="rtl" sur le document.
  useEffect(() => {
    if (Platform.OS !== 'web' || !lang) return;
    const dir = isRTL(lang) ? 'rtl' : 'ltr';
    const doc = (globalThis as { document?: Document }).document;
    if (doc) doc.documentElement.setAttribute('dir', dir);
  }, [lang]);

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

  // Apparence effective :
  //  • Auto : suit le système (dark/light) ou l'heure de nuit programmée ;
  //  • Jour / Nuit : forcé ;
  //  • Nuit programmée : hors de [nightStart, nightEnd] → Nuit.
  // La palette (jour/nuit/néon) est indépendante : nuit + néon reste une
  // option de couleurs fluorescentes.
  const appearanceEff = useMemo(() => {
    const s = settings;
    if (!s) return 'auto';
    if (s.appearance === 'auto') {
      const g = globalThis as unknown as { __onduloNight?: boolean };
      if (typeof g.__onduloNight === 'boolean') return g.__onduloNight ? 'nuit' : 'jour';
      return 'nuit';
    }
    if (s.appearance === 'scheduled') {
      const now = new Date();
      const m = now.getHours() * 60 + now.getMinutes();
      const start = s.nightStart ?? 20 * 60;
      const end = s.nightEnd ?? 7 * 60;
      const isNight = start > end ? m >= start || m < end : m >= start && m < end;
      return isNight ? 'nuit' : 'jour';
    }
    return s.appearance;
  }, [settings]);

  const theme = useMemo(() => {
    const s = settings;
    if (!s) return THEMES.nuit;
    const palette = s.palette ?? 'nuit';
    if (appearanceEff === 'nuit') return THEMES[palette === 'jour' ? 'nuit' : palette];
    if (palette === 'neon') return THEMES.neon;
    return THEMES.jour;
  }, [settings, appearanceEff]);
  const t = dict;
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
