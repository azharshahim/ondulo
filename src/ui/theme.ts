// ─── Thèmes visuels : apparence Jour / Nuit (Auto par défaut) ───────────────
// Le néon reste une option de palette indépendante (Nuit + néon).
// Les thèmes clair/sombre sont conservés pour les palettes secondaires.
import type { ThemeId } from '../state/storage';

export interface Theme {
  id: ThemeId;
  bgGradient: [string, string, string];
  panel: string;
  panelBorder: string;
  text: string;
  subtext: string;
  cell: string;
  cellBorder: string;
  holeInner: string;
  accent: string;
  accent2: string;
  /** Variante d'accent lisible en TEXTE sur le fond (≥ 4,5:1). */
  accentText: string;
  /** Couleur de texte d'erreur, adaptée au fond (≥ 4,5:1). */
  error: string;
  buttonText: string;
  isDark: boolean;
  /** Couleur douce du filtre chaud (rgba) en mode Nuit. */
  warmOverlay: string;
  /** Couleur de l'arrière-plan des cases en mode Nuit. */
  cellNight: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  // ── Jour : lumineux, fond clair dégradé, nuages ──
  jour: {
    id: 'jour',
    bgGradient: ['#FFF6EC', '#E8F4FF', '#DCEFFE'],
    panel: 'rgba(255,255,255,0.80)',
    panelBorder: 'rgba(38,49,78,0.10)',
    text: '#26314E',
    // 0,78 au lieu de 0,62 : le texte secondaire passait de 3,73:1 à ≥ 4,5:1
    // sur tous les arrêts du dégradé (identité conservée : même encre).
    subtext: 'rgba(38,49,78,0.78)',
    cell: 'rgba(255,255,255,0.70)',
    cellBorder: 'rgba(38,49,78,0.10)',
    holeInner: '#26314E',
    // Corail et azur d'origine (#EF6B73 / #0A9BEF) ne donnaient que 2,99:1 et
    // 3,02:1 avec un libellé blanc : même teinte, un cran plus profonde.
    accent: '#C52028',
    accent2: '#1576BC',
    accentText: '#AD1F26',
    error: '#B23A16',
    buttonText: '#FFFFFF',
    isDark: false,
    warmOverlay: 'rgba(255, 220, 150, 0)',
    cellNight: '#EAF4FF',
  },
  // ── Nuit : bleu nuit, cases bleu-gris sombres, filtre chaud ──
  nuit: {
    id: 'nuit',
    bgGradient: ['#0E1430', '#1A2455', '#0A0E26'],
    panel: 'rgba(255,255,255,0.08)',
    panelBorder: 'rgba(255,255,255,0.14)',
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.65)',
    cell: 'rgba(255,255,255,0.06)',
    cellBorder: 'rgba(255,255,255,0.12)',
    holeInner: '#0A0F24',
    accent: '#C52028',
    accent2: '#1576BC',
    // Sur fond nuit, l'accent utilisé en TEXTE doit être clair : #7CC4FF
    // donne 7,84:1 sur l'arrêt le plus clair du dégradé.
    accentText: '#7CC4FF',
    error: '#FF8A65',
    buttonText: '#FFFFFF',
    isDark: true,
    warmOverlay: 'rgba(255, 180, 100, 0.07)',
    cellNight: '#3A4A6E',
  },
  // ── Néon : palette Nuit + couleurs fluorescentes (option indépendante) ──
  neon: {
    id: 'neon',
    bgGradient: ['#05010F', '#160B2E', '#010A14'],
    panel: 'rgba(0,255,255,0.06)',
    panelBorder: 'rgba(255,0,255,0.28)',
    text: '#F0F9FF',
    subtext: 'rgba(165,243,252,0.7)',
    cell: 'rgba(0,255,255,0.07)',
    cellBorder: 'rgba(0,255,255,0.30)',
    holeInner: '#020208',
    accent: '#C1135F',
    accent2: '#00707D',
    accentText: '#8BF3FF',
    error: '#FF8A65',
    buttonText: '#FFFFFF',
    isDark: true,
    warmOverlay: 'rgba(255, 180, 100, 0.05)',
    cellNight: '#1A1A3E',
  },
  // ── Palettes secondaires (clair/sombre conservés) ──
  clair: {
    id: 'clair',
    bgGradient: ['#FFE8D6', '#FFF6EC', '#DCEFFE'],
    panel: 'rgba(255,255,255,0.78)',
    panelBorder: 'rgba(38,49,78,0.10)',
    text: '#26314E',
    // 0,78 au lieu de 0,62 : le texte secondaire passait de 3,73:1 à ≥ 4,5:1
    // sur tous les arrêts du dégradé (identité conservée : même encre).
    subtext: 'rgba(38,49,78,0.78)',
    cell: 'rgba(255,255,255,0.66)',
    cellBorder: 'rgba(38,49,78,0.10)',
    holeInner: '#26314E',
    accent: '#C52028',
    accent2: '#1576BC',
    accentText: '#AD1F26',
    error: '#B23A16',
    buttonText: '#FFFFFF',
    isDark: false,
    warmOverlay: 'rgba(255, 220, 150, 0)',
    cellNight: '#EAF4FF',
  },
  sombre: {
    id: 'sombre',
    bgGradient: ['#141433', '#1E1B4B', '#0B0B1E'],
    panel: 'rgba(255,255,255,0.08)',
    panelBorder: 'rgba(255,255,255,0.14)',
    text: '#FFFFFF',
    subtext: 'rgba(255,255,255,0.65)',
    cell: 'rgba(255,255,255,0.10)',
    cellBorder: 'rgba(255,255,255,0.18)',
    holeInner: '#101024',
    accent: '#C52028',
    accent2: '#1576BC',
    accentText: '#7CC4FF',
    error: '#FF8A65',
    buttonText: '#FFFFFF',
    isDark: true,
    warmOverlay: 'rgba(255, 180, 100, 0.06)',
    cellNight: '#2A3050',
  },
};
