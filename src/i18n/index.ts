// ─── Système d'internationalisation Ondulo ─────────────────────────────────
//  • un fichier JSON par langue (locales/*.json) : aucun texte en dur
//    dans le code, aucun texte dans les images ;
//  • détection automatique de la langue de l'appareil (expo-localization),
//    repli sur l'anglais ;
//  • sélection manuelle possible au premier lancement et dans Réglages ;
//  • direction RTL automatique pour les langues de droite à gauche (arabe).
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang =
  | 'en' | 'fr' | 'es' | 'pt-BR' | 'de' | 'it' | 'ru' | 'tr'
  | 'ar' | 'id' | 'ja' | 'ko' | 'zh-Hans';

export const LANG_LIST: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'fr', name: 'Français' },
  { id: 'es', name: 'Español' },
  { id: 'pt-BR', name: 'Português (BR)' },
  { id: 'de', name: 'Deutsch' },
  { id: 'it', name: 'Italiano' },
  { id: 'ru', name: 'Русский' },
  { id: 'tr', name: 'Türkçe' },
  { id: 'ar', name: 'العربية' },
  { id: 'id', name: 'Bahasa Indonesia' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'zh-Hans', name: '简体中文' },
];

export const LANG_IDS: Lang[] = LANG_LIST.map((l) => l.id);

/** Langues rendues de droite à gauche. */
export const RTL_LANGS: Lang[] = ['ar'];

export const isRTL = (lang: Lang): boolean => RTL_LANGS.includes(lang);

/** Détection automatique de la langue de l'appareil, repli sur l'anglais. */
export async function detectLang(): Promise<Lang> {
  try {
    const sysLocales = getLocales().map((l: { languageCode?: string | null }) => l.languageCode);
    for (const raw of sysLocales) {
      if (!raw) continue;
      const norm = raw.toLowerCase();
      // correspondance explicite
      const exact = LANG_IDS.find((l) => l.toLowerCase() === norm);
      if (exact) return exact;
      // base sans région (en-US → en)
      const base = norm.split('-')[0];
      const baseMatch = LANG_IDS.find((l) => l.toLowerCase() === base);
      if (baseMatch) return baseMatch;
      // alias : es-419/es-MX → es ; zh-Hans-CN → zh-Hans ; id-ID → id
      if (base === 'zh' && (norm.includes('hans') || norm.includes('hant'))) return 'zh-Hans';
    }
  } catch { /* repli sur l'anglais */ }
  return 'en';
}

const LANG_KEY = '@ondulo/lang';

export async function loadLang(): Promise<Lang> {
  try {
    const saved = await AsyncStorage.getItem(LANG_KEY);
    if (saved && LANG_IDS.includes(saved as Lang)) return saved as Lang;
  } catch { /* ignore */ }
  return detectLang();
}

export async function saveLang(lang: Lang): Promise<void> {
  try {
    await AsyncStorage.setItem(LANG_KEY, lang);
  } catch { /* ignore */ }
}

/** Dictionnaire chargé des JSON (clé → texte dans la langue active). */
export type Dict = Record<string, string>;

// Imports statiques : Metro doit les connaître pour le bundle (un require
// dynamique cassait le bundle web avec un 500).
import enDict from './locales/en.json';
import frDict from './locales/fr.json';
import esDict from './locales/es.json';
import ptBRDict from './locales/pt-BR.json';
import deDict from './locales/de.json';
import itDict from './locales/it.json';
import ruDict from './locales/ru.json';
import trDict from './locales/tr.json';
import arDict from './locales/ar.json';
import idDict from './locales/id.json';
import jaDict from './locales/ja.json';
import koDict from './locales/ko.json';
import zhHansDict from './locales/zh-Hans.json';

const caches: Record<Lang, Dict> = {
  en: enDict as Dict, fr: frDict as Dict, es: esDict as Dict, 'pt-BR': ptBRDict as Dict,
  de: deDict as Dict, it: itDict as Dict, ru: ruDict as Dict, tr: trDict as Dict,
  ar: arDict as Dict, id: idDict as Dict, ja: jaDict as Dict, ko: koDict as Dict,
  'zh-Hans': zhHansDict as Dict,
};

function ensureLoaded(lang: Lang): Dict {
  return caches[lang];
}

export function getLangs(): { id: Lang; name: string }[] {
  return LANG_LIST.map((l) => ({ id: l.id, name: l.name }));
}

/** Récupère un dictionnaire de traduction (synchrone, avec fallback). */
export function loadDict(lang: Lang): Dict {
  return ensureLoaded(lang);
}

/** Traduction en direct (synchrone). */
export function t(lang: Lang, key: string): string {
  const dict = ensureLoaded(lang);
  return dict[key] ?? caches.en[key] ?? key;
}

/** Traductions par langue (chargées une fois pour l'application). */
export async function loadAll(): Promise<Record<Lang, Dict>> {
  const out: Record<Lang, Dict> = {} as Record<Lang, Dict>;
  for (const lang of LANG_IDS) {
    out[lang] = await ensureLoaded(lang);
  }
  return out;
}
