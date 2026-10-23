// ─── Palette vive harmonieuse + symboles pour daltoniens ───────────────────
// Chaque couleur possède un symbole distinct : en mode accessibilité (ou
// toujours sur les trous), le symbole permet de distinguer les couleurs
// sans se fier uniquement à la teinte.
import type { ColorId } from './types';

export interface ColorInfo {
  id: ColorId;
  nameFr: string;
  nameEn: string;
  main: string;
  dark: string;
  light: string;
  /** Symbole géométrique unique (daltonisme). */
  symbol: string;
}

export const COLORS: Record<ColorId, ColorInfo> = {
  corail: { id: 'corail', nameFr: 'Rouge corail', nameEn: 'Coral red', main: '#FF5964', dark: '#D63A46', light: '#FF9AA2', symbol: '●' },
  soleil: { id: 'soleil', nameFr: 'Jaune soleil', nameEn: 'Sun yellow', main: '#FFC93C', dark: '#DEA400', light: '#FFE08A', symbol: '▲' },
  lime: { id: 'lime', nameFr: 'Vert lime', nameEn: 'Lime green', main: '#8BD450', dark: '#5FA832', light: '#C6F79B', symbol: '■' },
  azur: { id: 'azur', nameFr: 'Bleu azur', nameEn: 'Azure blue', main: '#3FA7FF', dark: '#2478CC', light: '#9AD1FF', symbol: '◆' },
  violet: { id: 'violet', nameFr: 'Violet', nameEn: 'Purple', main: '#9B5DE5', dark: '#7440B8', light: '#CDA9FF', symbol: '★' },
  rose: { id: 'rose', nameFr: 'Rose', nameEn: 'Pink', main: '#F15BB5', dark: '#C23585', light: '#FFA8D8', symbol: '♥' },
  orange: { id: 'orange', nameFr: 'Orange', nameEn: 'Orange', main: '#FF8C42', dark: '#D96A24', light: '#FFBE8F', symbol: '✚' },
  marron: { id: 'marron', nameFr: 'Marron', nameEn: 'Brown', main: '#B07D54', dark: '#7E5636', light: '#D9B48C', symbol: '⬢' },
};

export const COLOR_ORDER: ColorId[] = [
  'corail', 'soleil', 'lime', 'azur', 'violet', 'rose', 'orange', 'marron',
];
