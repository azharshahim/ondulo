// ─── 10 niveaux écrits à la main (difficulté progressive) ──────────────────
// Format JSON lisible : la grille est dessinée en chaînes ('1' = case,
// '0' = zone noire), les serpents sont listés tête → queue.
// Chaque niveau est validé par le solveur (voir tools/validate-levels.ts) :
// `optimal` est rempli automatiquement au premier chargement si absent —
// ici on le laisse à 0 et src/levels/levels.ts le calcule via le solveur.
import type { ColorId, HoleDef, LevelDef, SnakeDef } from '../game/types';

const grid = (rows: string[]): number[][] =>
  rows.map((row) => row.split('').map((ch) => (ch === '1' ? 1 : 0)));

const S = (id: string, color: ColorId, pts: [number, number][]): SnakeDef => ({
  id, color, cells: pts.map(([r, c]) => ({ r, c })),
});
const H = (id: string, color: ColorId, r: number, c: number): HoleDef => ({
  id, color, cell: { r, c },
});

type Raw = Omit<LevelDef, 'optimal' | 'solverValidated'>;
const L = (raw: Raw): LevelDef => ({ ...raw, optimal: 0, solverValidated: false });

export const HANDCRAFTED: LevelDef[] = [
  L({
    id: 1, titleFr: 'Premiers pas', titleEn: 'First steps', rows: 5, cols: 5,
    grid: grid(['11111', '11111', '11111', '11111', '11111']),
    snakes: [
      S('s1', 'corail', [[2, 1], [2, 2], [1, 2]]),
      S('s2', 'azur', [[3, 3], [3, 2], [4, 2]]),
    ],
    trous: [H('h1', 'corail', 1, 0), H('h2', 'azur', 4, 4)],
  }),
  L({
    id: 2, titleFr: 'Trois chemins', titleEn: 'Three paths', rows: 5, cols: 5,
    grid: grid(['11111', '11111', '11111', '11111', '11111']),
    snakes: [
      S('s1', 'soleil', [[2, 2], [2, 1], [3, 1]]),
      S('s2', 'corail', [[4, 3], [4, 2], [3, 2]]),
      S('s3', 'lime', [[0, 3], [0, 4], [1, 4]]),
    ],
    trous: [H('h1', 'soleil', 0, 1), H('h2', 'corail', 4, 4), H('h3', 'lime', 4, 0)],
  }),
  L({
    id: 3, titleFr: 'Le couloir', titleEn: 'The corridor', rows: 6, cols: 5,
    grid: grid(['11111', '11111', '01111', '11111', '11110', '11111']),
    snakes: [
      S('s1', 'violet', [[1, 1], [1, 2], [1, 3], [2, 3]]),
      S('s2', 'rose', [[4, 1], [3, 1], [3, 2]]),
      S('s3', 'orange', [[2, 4], [3, 4], [3, 3]]),
    ],
    trous: [H('h1', 'violet', 0, 4), H('h2', 'rose', 5, 0), H('h3', 'orange', 5, 3)],
  }),
  L({
    id: 4, titleFr: 'Croisements', titleEn: 'Crossroads', rows: 6, cols: 6,
    grid: grid(['011110', '111111', '111111', '111111', '111111', '011110']),
    snakes: [
      S('s1', 'corail', [[2, 2], [2, 3], [2, 4], [3, 4]]),
      S('s2', 'azur', [[4, 4], [4, 3], [4, 2], [3, 2]]),
      S('s3', 'violet', [[1, 1], [1, 2], [1, 3]]),
      S('s4', 'soleil', [[5, 1], [4, 1], [4, 0]]),
    ],
    trous: [
      H('h1', 'corail', 2, 0), H('h2', 'azur', 5, 2),
      H('h3', 'violet', 0, 3), H('h4', 'soleil', 0, 1),
    ],
  }),
  L({
    id: 5, titleFr: 'Le mur', titleEn: 'The wall', rows: 6, cols: 7,
    grid: grid(['1111111', '1111111', '1111111', '1100011', '1111111', '1111111']),
    snakes: [
      S('s1', 'lime', [[1, 3], [1, 2], [1, 1], [2, 1]]),
      S('s2', 'corail', [[4, 3], [4, 4], [4, 5], [3, 5]]),
      S('s3', 'azur', [[5, 0], [4, 0], [4, 1]]),
      S('s4', 'rose', [[0, 5], [0, 6], [1, 6]]),
    ],
    trous: [
      H('h1', 'lime', 5, 3), H('h2', 'corail', 0, 0),
      H('h3', 'azur', 2, 6), H('h4', 'rose', 5, 6),
    ],
  }),
  L({
    id: 6, titleFr: 'La tour T', titleEn: 'T tower', rows: 7, cols: 6,
    grid: grid(['111111', '111111', '011110', '011110', '011110', '011110', '011110']),
    snakes: [
      S('s1', 'orange', [[3, 2], [4, 2], [5, 2], [5, 3]]),
      S('s2', 'violet', [[1, 4], [1, 3], [1, 2], [1, 1]]),
      S('s3', 'azur', [[0, 1], [0, 0], [1, 0]]),
      S('s4', 'lime', [[6, 4], [5, 4], [4, 4]]),
    ],
    trous: [
      H('h1', 'orange', 0, 5), H('h2', 'violet', 6, 2),
      H('h3', 'azur', 6, 1), H('h4', 'lime', 0, 2),
    ],
  }),
  L({
    id: 7, titleFr: "L'anneau", titleEn: 'The ring', rows: 7, cols: 7,
    grid: grid(['1111111', '1000001', '1000001', '1000001', '1000001', '1000001', '1111111']),
    snakes: [
      S('s1', 'corail', [[0, 1], [0, 2], [0, 3]]),
      S('s2', 'azur', [[3, 6], [4, 6], [5, 6]]),
      S('s3', 'soleil', [[6, 5], [6, 4], [6, 3]]),
      S('s4', 'lime', [[3, 0], [2, 0], [1, 0]]),
    ],
    trous: [
      H('h1', 'corail', 0, 6), H('h2', 'azur', 6, 6),
      H('h3', 'soleil', 6, 0), H('h4', 'lime', 0, 0),
    ],
  }),
  L({
    id: 8, titleFr: 'Le H', titleEn: 'The H', rows: 7, cols: 7,
    grid: grid(['1100011', '1100011', '1100011', '1111111', '1100011', '1100011', '1100011']),
    snakes: [
      S('s1', 'rose', [[1, 1], [2, 1], [3, 1]]),
      S('s2', 'orange', [[5, 5], [4, 5], [3, 5]]),
      S('s3', 'violet', [[0, 5], [1, 5], [2, 5]]),
      S('s4', 'azur', [[6, 1], [5, 1], [4, 1]]),
      S('s5', 'lime', [[3, 2], [3, 3], [3, 4]]),
    ],
    trous: [
      H('h1', 'rose', 6, 5), H('h2', 'orange', 0, 0),
      H('h3', 'violet', 3, 0), H('h4', 'azur', 0, 6),
      H('h5', 'lime', 6, 6),
    ],
  }),
  L({
    id: 9, titleFr: 'Gruyère', titleEn: 'Swiss cheese', rows: 7, cols: 7,
    grid: grid(['1111111', '1101011', '1111111', '1011101', '1111111', '1101011', '1111111']),
    snakes: [
      S('s1', 'corail', [[0, 1], [0, 2], [0, 3], [0, 4]]),
      S('s2', 'soleil', [[2, 5], [2, 4], [2, 3], [2, 2]]),
      S('s3', 'azur', [[4, 1], [5, 1 - 0], [6, 1], [6, 2]]),
      S('s4', 'violet', [[6, 5], [5, 5], [4, 5], [4, 4]]),
      S('s5', 'lime', [[3, 3], [4, 3], [4, 2]]),
    ],
    trous: [
      H('h1', 'corail', 6, 0), H('h2', 'soleil', 0, 5),
      H('h3', 'azur', 0, 6), H('h4', 'violet', 0, 0),
      H('h5', 'lime', 6, 6),
    ],
  }),
  L({
    id: 10, titleFr: 'Grande mêlée', titleEn: 'Grand melee', rows: 8, cols: 7,
    grid: grid([
      '1111111', '1111111', '1101011', '1111111',
      '1111111', '1101011', '1111111', '1111111',
    ]),
    snakes: [
      S('s1', 'corail', [[0, 1], [0, 2], [0, 3], [1, 3]]),
      S('s2', 'soleil', [[2, 0], [3, 0], [4, 0], [4, 1]]),
      S('s3', 'azur', [[1, 5], [1, 6], [2, 6], [3, 6]]),
      S('s4', 'violet', [[6, 2], [6, 1], [6, 0], [5, 0]]),
      S('s5', 'rose', [[7, 4], [7, 5], [6, 5], [5, 5]]),
      S('s6', 'lime', [[3, 2], [3, 3], [4, 3]]),
    ],
    trous: [
      H('h1', 'corail', 7, 0), H('h2', 'soleil', 0, 6),
      H('h3', 'azur', 7, 6), H('h4', 'violet', 0, 0),
      H('h5', 'rose', 0, 4), H('h6', 'lime', 7, 3),
    ],
  }),
];
