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
  /** Police lisible pour la dyslexie. */
  dyslexicFont: boolean;
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
  dyslexicFont: false,
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

// Clés HISTORIQUES (ancien nom du projet) : NE PAS renommer. Elles contiennent
// la progression et les réglages déjà enregistrés sur les appareils ; les
// changer effacerait la sauvegarde des joueurs existants. Les nouvelles clés
// (profils, parental, langue) utilisent déjà le préfixe @ondulo.
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

// ─── Profils (jusqu'à 4) ───────────────────────────────────────────────────
export type AgeGroup = '3-5' | '6-9' | '10-13' | '14+';

export const AGE_GROUPS: { id: AgeGroup; label: string }[] = [
  { id: '3-5', label: '3-5 ans' },
  { id: '6-9', label: '6-9 ans' },
  { id: '10-13', label: '10-13 ans' },
  { id: '14+', label: '14+ ans' },
];

export interface Profile {
  id: string;
  name: string;
  avatarColor: string;      // couleur du serpent-avatar
  ageGroup: AgeGroup;       // tranche d'âge
  stars: Record<string, number>;
  unlocked: number;
  daily: Record<string, number>;
  /** Étoiles débloquées (skins). */
  skins: SkinId[];
  /** Temps de jeu (minutes) enregistré. */
  playTimeMin: number;
  /** Niveaux terminés. */
  levelsDone: number;
  /** Dernier lancement (ms) pour le délai de pause. */
  lastPlayed: number;
  /** Enfant : interface simplifiée + aide automatique. */
  isChild: boolean;
}

export interface ProfilesData {
  profiles: Profile[];
  activeId: string | null;
}

export const DEFAULT_PROFILES: ProfilesData = { profiles: [], activeId: null };

export async function loadProfiles(): Promise<ProfilesData> {
  try {
    const raw = await AsyncStorage.getItem(PROFILES_KEY);
    return raw ? { ...DEFAULT_PROFILES, ...JSON.parse(raw) } : DEFAULT_PROFILES;
  } catch {
    return DEFAULT_PROFILES;
  }
}

export async function saveProfiles(p: ProfilesData): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(p));
  } catch { /* ignore */ }
}

// ─── Mode parental ─────────────────────────────────────────────────────────
/** HASH du PIN : haché + salé (SHA-256) stocké via expo-secure-store. */
export interface ParentalSettings {
  /** HASH hex du PIN (non le PIN en clair). */
  pinHash: string | null;
  /** Question de calcul (barrière parentale). */
  puzzleQuestion: string;
  puzzleAnswer: string;
  /** Limite quotidienne (minutes). 0 = infini. */
  dailyLimitMin: number;
  /** Plage de coucher sans jeu : [startMin, endMin] (minutes depuis minuit). */
  bedtimeStartMin: number;
  bedtimeEndMin: number;
  /** Rappel de pause toutes les X minutes. */
  pauseReminderMin: number;
  /** Interrupteurs (désactivés par défaut). */
  soundOn: boolean;
  hapticsOn: boolean;
  hintsOn: boolean;
  notificationsOn: boolean;
}

export const DEFAULT_PARENTAL: ParentalSettings = {
  pinHash: null,
  puzzleQuestion: '',
  puzzleAnswer: '',
  dailyLimitMin: 0,
  bedtimeStartMin: 20 * 60,
  bedtimeEndMin: 7 * 60,
  pauseReminderMin: 20,
  soundOn: true,
  hapticsOn: true,
  hintsOn: true,
  notificationsOn: false,
};

export async function loadParental(): Promise<ParentalSettings> {
  try {
    const raw = await AsyncStorage.getItem(PARENTAL_KEY);
    return raw ? { ...DEFAULT_PARENTAL, ...JSON.parse(raw) } : DEFAULT_PARENTAL;
  } catch {
    return DEFAULT_PARENTAL;
  }
}

export async function saveParental(s: ParentalSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(PARENTAL_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

// ─── Claviers de stockage ───────────────────────────────────────────────────
const PROFILES_KEY = '@ondulo/profiles';
const PARENTAL_KEY = '@ondulo/parental';
