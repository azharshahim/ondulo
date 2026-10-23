// ─── Thèmes visuels : sombre (défaut), clair, néon ─────────────────────────
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
  buttonText: string;
  isDark: boolean;
}

export const THEMES: Record<ThemeId, Theme> = {
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
    accent: '#FF5964',
    accent2: '#3FA7FF',
    buttonText: '#FFFFFF',
    isDark: true,
  },
  clair: {
    id: 'clair',
    bgGradient: ['#FFE8D6', '#FFF6EC', '#DCEFFE'],
    panel: 'rgba(255,255,255,0.78)',
    panelBorder: 'rgba(38,49,78,0.10)',
    text: '#26314E',
    subtext: 'rgba(38,49,78,0.62)',
    cell: 'rgba(255,255,255,0.66)',
    cellBorder: 'rgba(38,49,78,0.10)',
    holeInner: '#26314E',
    accent: '#FF5964',
    accent2: '#2478CC',
    buttonText: '#FFFFFF',
    isDark: false,
  },
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
    accent: '#FF2E88',
    accent2: '#00E5FF',
    buttonText: '#FFFFFF',
    isDark: true,
  },
};
