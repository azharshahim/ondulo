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
  corail: { id: 'corail', nameFr: 'Rouge corail', nameEn: 'Coral red', main: '#EF6B73', dark: '#B84A54', light: '#F8B4B9', symbol: '●' },
  soleil: { id: 'soleil', nameFr: 'Jaune soleil', nameEn: 'Sun yellow', main: '#F2D94E', dark: '#C9A227', light: '#F9E784', symbol: '▲' },
  lime: { id: 'lime', nameFr: 'Vert lime', nameEn: 'Lime green', main: '#9BDD4A', dark: '#74B32E', light: '#C4EE8E', symbol: '■' },
  azur: { id: 'azur', nameFr: 'Bleu azur', nameEn: 'Azure blue', main: '#0A9BEF', dark: '#0773B8', light: '#6EC6FF', symbol: '◆' },
  violet: { id: 'violet', nameFr: 'Violet', nameEn: 'Purple', main: '#C9A0F5', dark: '#9C72D6', light: '#E2CCFF', symbol: '★' },
  rose: { id: 'rose', nameFr: 'Rose', nameEn: 'Pink', main: '#E89BDD', dark: '#C276B4', light: '#F6C4EE', symbol: '♥' },
  orange: { id: 'orange', nameFr: 'Orange', nameEn: 'Orange', main: '#F0B63F', dark: '#C88A22', light: '#FBD184', symbol: '✚' },
  marron: { id: 'marron', nameFr: 'Marron', nameEn: 'Brown', main: '#A86A55', dark: '#7F4E3A', light: '#C99B83', symbol: '⬢' },
};

export const COLOR_ORDER: ColorId[] = [
  'corail', 'soleil', 'lime', 'azur', 'violet', 'rose', 'orange', 'marron',
];
