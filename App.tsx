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
import ProfileScreen from './src/screens/ProfileScreen';
import ParentalDashboardScreen from './src/screens/ParentalDashboardScreen';
import SleepScreen from './src/screens/SleepScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import TutorialScreen from './src/screens/TutorialScreen';
import ParentalGate from './src/screens/ParentalGate';
import PinScreen from './src/screens/PinScreen';
import PauseReminder from './src/ui/PauseReminder';
import {
  loadLang, loadDict, saveLang, isRTL, type Lang, type Dict,
} from './src/i18n';
import {
  loadProgress, loadSettings, saveProgress, saveSettings, totalStars,
  loadProfiles, saveProfiles, loadParental, saveParental,
  type Progress, type Settings, type ProfilesData, type ParentalSettings,
} from './src/state/storage';
import { todayKey, TOTAL_LEVELS } from './src/levels/levels';
import { createPlayClock, EXTENSION_MIN, type PlayClock, type PlayStatus } from './src/state/timeRules';
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
  | { name: 'profiles' }
  | { name: 'parental' }
  | { name: 'privacy' }
  | { name: 'pin' }
  | { name: 'sleep' }
  | { name: 'tutorial' }
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
    // Zoom autorisé sur le reste de la page, interdit sur le plateau.
    '[data-testid="game-board"] { touch-action: none; user-scalable: none; }',
    'html, body { touch-action: pan-x pan-y; }',
    'input, button, [role="button"] { font-size: 16px; }',
  ].join('\n');
  doc.head.appendChild(style);
  const meta = doc.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1, viewport-fit=cover',
    );
  }
  // Balise meta description (SEO / partage).
  const desc = doc.querySelector('meta[name="description"]');
  if (!desc) {
    const m = doc.createElement('meta');
    m.setAttribute('name', 'description');
    m.setAttribute('content', 'Ondulo : jeu de réflexion familial sans minuteur. Glisse les serpents dans leurs trous !');
    doc.head.appendChild(m);
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
  // Police lisible (dyslexie) : appliquée via un style global.
  try {
    if ((globalThis as { __onduloDyslexic?: boolean }).__onduloDyslexic) {
      const d = doc.createElement('style');
      d.id = 'ondulo-dyslexic';
      d.textContent = "body, #root * { font-family: 'Arial', 'Segoe UI', sans-serif !important; letter-spacing: 0.4px !important; }";
      doc.head.appendChild(d);
    }
  } catch { /* ignore */ }
}

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [profiles, setProfiles] = useState<ProfilesData | null>(null);
  const [parental, setParental] = useState<ParentalSettings | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  // ── Porte parentale : aucun écran réservé aux adultes n'est atteignable
  // sans PIN ou barrière de calcul. Le déverrouillage ne vaut que pour la
  // session en cours (il est oublié au rechargement).
  const [parentalUnlocked, setParentalUnlocked] = useState(false);
  const [gate, setGate] = useState<null | 'parental' | 'privacy' | 'extend'>(null);
  // ── Règles de temps (limite, coucher, pause) : horloge de jeu unique ──
  const clockRef = React.useRef<PlayClock | null>(null);
  if (!clockRef.current) {
    clockRef.current = createPlayClock({
      config: { dailyLimitMin: 0, bedtimeStartMin: 20 * 60, bedtimeEndMin: 7 * 60, pauseReminderMin: 0 },
    });
  }
  const [playStatus, setPlayStatus] = useState<PlayStatus | null>(null);
  const [dict, setDict] = useState<Dict>({});
  // Appui sur « Jouer » : choix du profil (créer ou continuer) avant la partie.
  const [playAfterProfile, setPlayAfterProfile] = useState(false);
  const goAfterTutorial = () => {
    setPlayAfterProfile(false);
    setRoute({ name: 'game', levelNumber: Math.min(progress?.unlocked ?? 1, TOTAL_LEVELS) });
  };
  const goAfterProfile = (isNew: boolean) => {
    if (!playAfterProfile) { setRoute({ name: 'home' }); return; }
    // nouveau profil : mini-tutoriel avant la première partie
    if (isNew) { setRoute({ name: 'tutorial' }); return; }
    goAfterTutorial();
  };

  // Verrouillage de la page web (défilement, zoom, hauteur dynamique).
  useEffect(() => { installWebFixes(); }, []);

  // Chargement initial : langue (détection automatique, repli anglais),
  // dictionnaire de traduction (JSON), sauvegarde, profils, parental.
  useEffect(() => {
    (async () => {
      const [lang, s, p, prof, par] = await Promise.all([
        loadLang(),
        loadSettings(),
        loadProgress(),
        loadProfiles(),
        loadParental(),
      ]);
      setLang(lang);
      setDict(loadDict(lang));
      // une seule source de vérité : la langue effective (sauvegardée ou détectée)
      setSettings({ ...s, lang });
      setProgress(p);
      setProfiles(prof);
      setParental(par);
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
    if (patch.lang) {
      setLang(patch.lang);
      setDict(loadDict(patch.lang));
      void saveLang(patch.lang);
    }
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
  // ── Règles de temps ────────────────────────────────────────────────────
  // La configuration suit les réglages parentaux.
  useEffect(() => {
    if (!parental || !clockRef.current) return;
    clockRef.current.configure({
      dailyLimitMin: parental.dailyLimitMin,
      bedtimeStartMin: parental.bedtimeStartMin,
      bedtimeEndMin: parental.bedtimeEndMin,
      pauseReminderMin: parental.pauseReminderMin,
    });
    setPlayStatus(clockRef.current.status());
  }, [parental]);

  // L'horloge ne tourne que pendant une partie ; remise à zéro chaque jour.
  useEffect(() => {
    const clock = clockRef.current;
    if (!clock) return;
    clock.resetIfNewDay(todayKey());
    if (route.name === 'game' && !gate) clock.start();
    else clock.stop();
    setPlayStatus(clock.status());
    const iv = setInterval(() => {
      clock.resetIfNewDay(todayKey());
      setPlayStatus(clock.status());
    }, 5000);
    return () => clearInterval(iv);
  }, [route, gate]);

  // Le code parental prolonge la session de EXTENSION_MIN minutes.
  const extendSession = useCallback(() => {
    clockRef.current?.extend(EXTENSION_MIN);
    setPlayStatus(clockRef.current?.status() ?? null);
    setRoute((r) => (r.name === 'game' ? r : { name: 'home' }));
  }, []);

  // Toute entrée vers un écran « adulte » passe par la porte parentale.
  const requireParental = useCallback((intent: 'parental' | 'privacy', then: () => void) => {
    if (parentalUnlocked) { then(); return; }
    setGate(intent);
  }, [parentalUnlocked]);

  const onGateSuccess = useCallback(() => {
    const intent = gate;
    setParentalUnlocked(true);
    setGate(null);
    if (intent === 'privacy') setRoute({ name: 'privacy' });
    else if (intent === 'parental') setRoute({ name: 'parental' });
    else if (intent === 'extend') {
      clockRef.current?.extend(EXTENSION_MIN);
      setPlayStatus(clockRef.current?.status() ?? null);
    }
  }, [gate]);

  const t = dict;
  const stars = progress ? totalStars(progress) : 0;
  const dailyDone = !!progress?.daily[todayKey()];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <Background theme={theme} dyslexic={settings?.dyslexicFont ?? false}>
          {gate ? (
            <ParentalGate
              theme={theme}
              t={t}
              onSuccess={onGateSuccess}
              onCancel={() => setGate(null)}
            />
          ) : playStatus && (playStatus.kind === 'bedtime' || playStatus.kind === 'limit') ? (
            <SleepScreen
              theme={theme}
              t={t}
              onExtend={() => setGate('extend')}
            />
          ) : !settings || !progress ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={theme.accent2} />
            </View>
          ) : route.name === 'tutorial' ? (
            <TutorialScreen
              theme={theme}
              t={t}
              onDone={goAfterTutorial}
              onSkip={goAfterTutorial}
            />
          ) : route.name === 'home' ? (
            <HomeScreen
              theme={theme}
              t={t}
              currentLevel={Math.min(progress.unlocked, TOTAL_LEVELS)}
              totalStars={stars}
              dailyDone={dailyDone}
              onPlay={() => { setPlayAfterProfile(true); setRoute({ name: 'profiles' }); }}
              onLevels={() => setRoute({ name: 'levels' })}
              onDaily={() => setRoute({ name: 'game', levelNumber: null })}
              onSettings={() => setRoute({ name: 'settings' })}
              onProfiles={() => setRoute({ name: 'profiles' })}
              onParental={() => requireParental('parental', () => setRoute({ name: 'parental' }))}
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
          ) : route.name === 'profiles' ? (
            <ProfileScreen
              theme={theme}
              t={t}
              data={profiles ?? { profiles: [], activeId: null }}
              onPick={(id) => {
                setProfiles((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev, activeId: id };
                  void saveProfiles(next);
                  return next;
                });
                goAfterProfile(false);
              }}
              onCreate={(p) => {
                setProfiles((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev, profiles: [...prev.profiles, p], activeId: p.id };
                  void saveProfiles(next);
                  return next;
                });
                goAfterProfile(true);
              }}
              onBack={() => { setPlayAfterProfile(false); setRoute({ name: 'home' }); }}
            />
          ) : route.name === 'parental' ? (
            <ParentalDashboardScreen
              theme={theme}
              t={t}
              data={profiles ?? { profiles: [], activeId: null }}
              settings={parental ?? ({ pinHash: null } as ParentalSettings)}
              onChange={(patch) => {
                setParental((prev) => {
                  if (!prev) return prev;
                  const next = { ...prev, ...patch };
                  void saveParental(next);
                  return next;
                });
              }}
              onSetPin={() => setRoute({ name: 'pin' })}
              onPrivacy={() => requireParental('privacy', () => setRoute({ name: 'privacy' }))}
              onBack={() => setRoute({ name: 'home' })}
            />
          ) : route.name === 'pin' ? (
            <PinScreen theme={theme} t={t} onBack={() => setRoute({ name: 'parental' })} />
          ) : route.name === 'privacy' ? (
            <PrivacyScreen theme={theme} t={t} onBack={() => setRoute({ name: 'parental' })} />
          ) : route.name === 'sleep' ? (
            <SleepScreen
              theme={theme}
              t={t}
              onExtend={() => setGate('extend')}
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
          {playStatus?.kind === 'pause' && route.name === 'game' && !gate ? (
            <PauseReminder
              theme={theme}
              t={t}
              minutes={parental?.pauseReminderMin ?? 0}
              onPause={() => { clockRef.current?.acknowledgePause(); setRoute({ name: 'home' }); }}
              onContinue={() => {
                clockRef.current?.acknowledgePause();
                setPlayStatus(clockRef.current?.status() ?? null);
              }}
            />
          ) : null}
        </Background>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
