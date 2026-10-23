// ─── Sauvegarde automatique (AsyncStorage) ─────────────────────────────────
// Progression (étoiles, niveaux débloqués, défis quotidiens) et réglages
// (son, musique, vibrations, langue, thème, skin, mode daltonien).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from '../i18n';

export type ThemeId = 'jour' | 'nuit' | 'neon' | 'clair' | 'sombre';

/** Mode d'apparence : Auto (suit le système), Jour, Nuit, Nuit programmée. */
export type AppearanceMode = 'auto' | 'jour' | 'nuit' | 'scheduled';

/** Palette indépendante (Nuit + néon). */
export type PaletteId = 'jour' | 'nuit' | 'neon';
export type SkinId = 'classique' | 'rayures' | 'pois' | 'degrade' | 'arcenciel';

export interface SkinInfo {
  id: SkinId;
  /** Étoiles totales requises pour débloquer. */
  starsRequired: number;
}

export const SKINS: SkinInfo[] = [
  { id: 'classique', starsRequired: 0 },
  { id: 'rayures', starsRequired: 10 },
  { id: 'pois', starsRequired: 30 },
  { id: 'degrade', starsRequired: 60 },
  { id: 'arcenciel', starsRequired: 100 },
];

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  lang: Lang;
  theme: ThemeId;
  appearance: AppearanceMode;
  palette: PaletteId;
  /** Heure de début / fin de la nuit programmée (minutes depuis minuit). */
  nightStart?: number;
  nightEnd?: number;
  colorblind: boolean;
  skin: SkinId;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  haptics: true,
  lang: 'fr',
  theme: 'nuit',
  appearance: 'auto',
  palette: 'nuit',
  nightStart: 20 * 60, // 20h
  nightEnd: 7 * 60,     // 7h
  colorblind: false,
  skin: 'classique',
};

export interface Progress {
  /** Étoiles par niveau (clé = numéro de niveau, 1..60). */
  stars: Record<string, number>;
  /** Plus haut niveau débloqué (1 = seul le niveau 1 est ouvert). */
  unlocked: number;
  /** Défis quotidiens réussis : date AAAA-MM-JJ → étoiles. */
  daily: Record<string, number>;
}

export const DEFAULT_PROGRESS: Progress = { stars: {}, unlocked: 1, daily: {} };

const SETTINGS_KEY = '@serpent-puzzle/settings';
const PROGRESS_KEY = '@serpent-puzzle/progress';

export function totalStars(progress: Progress): number {
  return (
    Object.values(progress.stars).reduce((a, b) => a + b, 0) +
    Object.values(progress.daily).reduce((a, b) => a + b, 0)
  );
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* sauvegarde best-effort */ }
}

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    return raw ? { ...DEFAULT_PROGRESS, ...JSON.parse(raw) } : DEFAULT_PROGRESS;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export async function saveProgress(progress: Progress): Promise<void> {
  try {
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch { /* sauvegarde best-effort */ }
}
