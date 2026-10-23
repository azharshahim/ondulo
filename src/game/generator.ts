// ─── Générateur de niveaux à solvabilité garantie ──────────────────────────
// Principe (construction à l'envers) :
//   1. On place chaque serpent dans une position « pré-résolue » : une de ses
//      extrémités touche déjà son trou → il peut rentrer en 1 coup.
//   2. On « déroule » la partie par mouvements aléatoires valides (sans
//      jamais rentrer dans un trou). Chaque mouvement étant réversible
//      (l'inverse d'un mouvement de tête est un mouvement de queue), la
//      partie obtenue est TOUJOURS solvable : il suffit d'inverser le
//      déroulage puis de rentrer chaque serpent.
//   3. Le solveur A* valide ensuite le niveau et calcule l'optimal réel
//      quand la taille du plateau le permet (sinon l'optimal affiché est la
//      longueur de la solution garantie du générateur).
// Tout est déterministe (graine) : un même numéro de niveau donne toujours
// le même plateau, sur tous les appareils.
import type { Cell, ColorId, GameState, LevelDef, Move, SnakeDef, HoleDef } from './types';
import { COLOR_ORDER } from './colors';
import {
  applyMove, buildState, cloneState, isPlayable, isWin, keyOf, legalMoves, stateKey, tryMove,
} from './engine';
import { heuristic, solve } from './solver';

// ── RNG déterministe (mulberry32) ──────────────────────────────────────────
export function seedFromString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng(): number {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof mulberry32>;

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const randInt = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

// ── Formes de grilles irrégulières ─────────────────────────────────────────
export type ShapeName =
  | 'plein' | 'grille-trous' | 'croix' | 'T' | 'H' | 'escalier' | 'anneau' | 'L' | 'losange';

export const SHAPES: ShapeName[] = [
  'plein', 'grille-trous', 'croix', 'T', 'H', 'escalier', 'anneau', 'L', 'losange',
];

export function makeMask(rows: number, cols: number, shape: ShapeName, rng: Rng): boolean[][] {
  const mask: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const midR = Math.floor(rows / 2);
  const midC = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let on = false;
      switch (shape) {
        case 'plein': on = true; break;
        case 'grille-trous': on = true; break; // trous creusés après
        case 'croix':
          on = Math.abs(r - midR) <= (rows >= 8 ? 1 : 0) || Math.abs(c - midC) <= (cols >= 8 ? 1 : 0);
          break;
        case 'T':
          on = r <= 1 || (c >= midC - (cols >= 7 ? 1 : 0) && c <= midC);
          break;
        case 'H':
          on = c <= (cols >= 8 ? 1 : 0) || c >= cols - 1 - (cols >= 8 ? 1 : 0) || r === midR;
          break;
        case 'escalier': {
          const diag = rows > 1 && cols > 1 ? Math.abs(r / (rows - 1) - c / (cols - 1)) : 0;
          on = diag <= 0.36;
          break;
        }
        case 'anneau':
          on = r === 0 || c === 0 || r === rows - 1 || c === cols - 1;
          break;
        case 'L':
          on = c <= (cols >= 8 ? 1 : 0) || r >= rows - 1 - (rows >= 8 ? 1 : 0);
          break;
        case 'losange':
          on = Math.abs(r - (rows - 1) / 2) + Math.abs(c - (cols - 1) / 2) <= Math.min(rows, cols) / 2;
          break;
      }
      mask[r][c] = on;
    }
  }
  if (shape === 'grille-trous') {
    // Creuse ~12 % de cases intérieures (jamais les coins de bord critiques,
    // la connexité est vérifiée ensuite et l'essai rejeté si elle casse).
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() < 0.12) mask[r][c] = false;
      }
    }
  }
  return mask;
}

function playableCells(mask: boolean[][]): Cell[] {
  const cells: Cell[] = [];
  mask.forEach((row, r) => row.forEach((on, c) => { if (on) cells.push({ r, c }); }));
  return cells;
}

function isConnected(mask: boolean[][]): boolean {
  const cells = playableCells(mask);
  if (!cells.length) return false;
  const seen = new Set<string>([keyOf(cells[0].r, cells[0].c)]);
  const queue = [cells[0]];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = cur.r + dr, nc = cur.c + dc;
      if (mask[nr]?.[nc] && !seen.has(keyOf(nr, nc))) {
        seen.add(keyOf(nr, nc));
        queue.push({ r: nr, c: nc });
      }
    }
  }
  return seen.size === cells.length;
}

// ── Placement « pré-résolu » ───────────────────────────────────────────────
/** Marche auto-évitante aléatoire (avec retour arrière) de longueur `len`. */
function growPath(
  start: Cell, len: number, mask: boolean[][], blocked: Set<string>, rng: Rng,
): Cell[] | null {
  const path: Cell[] = [start];
  const inPath = new Set<string>([keyOf(start.r, start.c)]);
  const dfs = (): boolean => {
    if (path.length === len) return true;
    const last = path[path.length - 1];
    const neighbors = shuffle(
      [[-1, 0], [1, 0], [0, -1], [0, 1]]
        .map(([dr, dc]) => ({ r: last.r + dr, c: last.c + dc }))
        .filter((n) => mask[n.r]?.[n.c] && !blocked.has(keyOf(n.r, n.c)) && !inPath.has(keyOf(n.r, n.c))),
      rng,
    );
    for (const n of neighbors) {
      path.push(n); inPath.add(keyOf(n.r, n.c));
      if (dfs()) return true;
      path.pop(); inPath.delete(keyOf(n.r, n.c));
    }
    return false;
  };
  return dfs() ? path : null;
}

interface SnakeSpec { color: ColorId; len: number }

function placePresolved(
  mask: boolean[][], specs: SnakeSpec[], rng: Rng,
): { snakes: SnakeDef[]; trous: HoleDef[] } | null {
  const free = playableCells(mask);
  const occupied = new Set<string>();
  const holeCells = new Set<string>();
  const snakes: SnakeDef[] = [];
  const trous: HoleDef[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    let placed = false;
    for (const holeCell of shuffle(free, rng)) {
      const hk = keyOf(holeCell.r, holeCell.c);
      if (occupied.has(hk) || holeCells.has(hk)) continue;
      const starts = shuffle(
        [[-1, 0], [1, 0], [0, -1], [0, 1]]
          .map(([dr, dc]) => ({ r: holeCell.r + dr, c: holeCell.c + dc }))
          .filter((n) => mask[n.r]?.[n.c] && !occupied.has(keyOf(n.r, n.c)) && !holeCells.has(keyOf(n.r, n.c))),
        rng,
      );
      for (const start of starts) {
        const blocked = new Set([...occupied, ...holeCells, hk]);
        const path = growPath(start, spec.len, mask, blocked, rng);
        if (path) {
          // Orientation aléatoire : le trou est touché par la tête ou la queue.
          const cells = rng() < 0.5 ? path : [...path].reverse();
          cells.forEach((cell) => occupied.add(keyOf(cell.r, cell.c)));
          holeCells.add(hk);
          snakes.push({ id: `s${i + 1}`, color: spec.color, cells });
          trous.push({ id: `h${i + 1}`, color: spec.color, cell: holeCell });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) return null;
  }
  return { snakes, trous };
}

// ── Déroulage (mélange par mouvements aléatoires réversibles) ────────────
function scramble(
  level: LevelDef, presolved: GameState, count: number, rng: Rng, minHeuristic = 0,
): { state: GameState; snapshots: GameState[]; successes: number } {
  const snapshots: GameState[] = [cloneState(presolved)];
  let state = cloneState(presolved);
  let successes = 0;
  const maxAttempts = count * 80;
  // On déroule jusqu'à avoir assez de mouvements ET des serpents suffisamment
  // éloignés de leurs trous (sinon le niveau serait trivial).
  for (
    let attempt = 0;
    attempt < maxAttempts && (successes < count || heuristic(state) < minHeuristic);
    attempt++
  ) {
    const candidates = legalMoves(level, state).filter((m) => {
      // Jamais d'absorption pendant le déroulage : le niveau serait résolu.
      return !state.trous.some(
        (h) => !h.filled && h.cell.r === m.target.r && h.cell.c === m.target.c,
      );
    });
    if (!candidates.length) break;
    const move = candidates[Math.floor(rng() * candidates.length)];
    const res = tryMove(level, state, move.snakeId, move.end, move.target);
    if (res.status === 'moved') {
      state = res.state;
      snapshots.push(cloneState(state));
      successes += 1;
    }
  }
  return { state, snapshots, successes };
}

/** Reconstruit la solution garantie : inverse du déroulage + absorptions. */
function buildKnownSolution(level: LevelDef, snapshots: GameState[]): Move[] | null {
  const solution: Move[] = [];
  // Marche arrière : de l'état mélangé vers l'état pré-résolu.
  for (let i = snapshots.length - 1; i > 0; i--) {
    const from = snapshots[i];
    const targetKey = stateKey(snapshots[i - 1]);
    const inverse = legalMoves(level, from).find(
      (m) => stateKey(applyMove(level, from, m)) === targetKey,
    );
    if (!inverse) return null;
    solution.push(inverse);
  }
  // Puis absorption de chaque serpent depuis l'état pré-résolu.
  let cursor = cloneState(snapshots[0]);
  for (const snake of [...cursor.snakes]) {
    const move = legalMoves(level, cursor).find((m) => {
      if (m.snakeId !== snake.id) return false;
      const res = tryMove(level, cursor, m.snakeId, m.end, m.target);
      return res.status === 'absorbed';
    });
    if (!move) return null;
    solution.push(move);
    cursor = applyMove(level, cursor, move);
  }
  // Vérification complète en rejouant depuis l'état mélangé.
  let replay = cloneState(snapshots[snapshots.length - 1]);
  for (const move of solution) replay = applyMove(level, replay, move);
  return isWin(replay) ? solution : null;
}

// ── Génération complète d'un niveau ────────────────────────────────────────
export interface GenerateOptions {
  seed: number;
  rows: number;
  cols: number;
  shape: ShapeName;
  snakeCount: number;
  minLen: number;
  maxLen: number;
  colorCount: number;
  scrambleMoves: number;
  id: number | string;
  titleFr: string;
  titleEn: string;
  daily?: boolean;
  /** Affiche la raison des échecs d'essais (outils de validation uniquement). */
  debug?: boolean;
}

export function generateLevel(opts: GenerateOptions): LevelDef {
  const rng = mulberry32(opts.seed);
  const colorPool = shuffle(COLOR_ORDER, rng).slice(0, Math.max(1, opts.colorCount));
  const specs: SnakeSpec[] = Array.from({ length: opts.snakeCount }, (_, i) => ({
    color: colorPool[i % colorPool.length],
    len: randInt(rng, opts.minLen, opts.maxLen),
  }));
  const totalCells = specs.reduce((sum, s) => sum + s.len, 0);

  const fails = { area: 0, conn: 0, place: 0, scramble: 0, known: 0 };
  for (let attempt = 0; attempt < 200; attempt++) {
    // Après 60 échecs, on raccourcit légèrement les serpents : la génération
    // finit toujours par aboutir, même sur les grilles les plus denses.
    const effSpecs = attempt < 60
      ? specs
      : specs.map((s) => ({ ...s, len: Math.max(2, s.len - 1) }));
    const effTotal = effSpecs.reduce((sum, s) => sum + s.len, 0);
    const shape = attempt < 3 ? opts.shape : SHAPES[(seedFromString(String(opts.seed)) + attempt) % SHAPES.length];
    const mask = makeMask(opts.rows, opts.cols, shape, rng);
    const cells = playableCells(mask);
    // Il faut serpents + trous + quelques cases libres pour manoeuvrer
    // (la manoeuvrabilité réelle est prouvée par le déroulage ci-dessous).
    if (cells.length < effTotal + effSpecs.length + Math.max(5, cells.length * 0.1)) { fails.area += 1; continue; }
    if (!isConnected(mask)) { fails.conn += 1; continue; }

    const placed = placePresolved(mask, effSpecs, rng);
    if (!placed) { fails.place += 1; continue; }

    const level: LevelDef = {
      id: opts.id,
      titleFr: opts.titleFr,
      titleEn: opts.titleEn,
      rows: opts.rows,
      cols: opts.cols,
      grid: mask.map((row) => row.map((on) => (on ? 1 : 0))),
      snakes: placed.snakes,
      trous: placed.trous,
      optimal: 0,
      solverValidated: false,
      daily: opts.daily,
    };

    const presolved = buildState(level);
    const minHeuristic = Math.min(
      Math.max(4, Math.round(opts.scrambleMoves * 0.3)),
      opts.snakeCount * 3,
    );
    const { state, snapshots, successes } = scramble(level, presolved, opts.scrambleMoves, rng, minHeuristic);
    if (
      successes < Math.max(4, Math.floor(opts.scrambleMoves * 0.5)) ||
      heuristic(state) < minHeuristic * 0.6
    ) { fails.scramble += 1; continue; }

    const known = buildKnownSolution(level, snapshots);
    if (!known) { fails.known += 1; continue; }

    // Le plateau publié est l'état mélangé : on réécrit les positions initiales.
    level.snakes = state.snakes.map((s) => ({
      id: s.id, color: s.color, cells: s.cells.map((c) => ({ ...c })),
    }));

    const cap = opts.snakeCount <= 4 ? 60000 : opts.snakeCount <= 6 ? 30000 : opts.snakeCount <= 8 ? 6000 : 3000;
    const solved = solve(level, buildState(level), cap);
    if (solved.path) {
      level.optimal = solved.path.length;
      level.solverValidated = true;
      level.solution = solved.path;
    } else {
      level.optimal = known.length;
      level.solverValidated = false;
      level.solution = known;
    }
    return level;
  }
  if (opts.debug) console.log(`  [debug niveau ${opts.id}] échecs :`, fails, 'cases serpents:', totalCells);
  throw new Error(`Génération impossible pour le niveau ${opts.id} (graine ${opts.seed})`);
}

// ── Difficulté progressive des niveaux 11 → 60 ─────────────────────────────
export function generatedLevelForNumber(n: number): LevelDef {
  const t = (n - 11) / 49; // 0 → 1
  const rows = 5 + Math.round(t * 4); // 5 → 9
  const cols = 5 + Math.round(t * 3); // 5 → 8
  const snakeCount = Math.min(10, 3 + Math.floor((n - 11) / 6)); // 3 → 10
  const colorCount = Math.min(8, 3 + Math.floor((n - 11) / 8)); // 3 → 8
  return generateLevel({
    seed: 9871 + n * 131,
    rows,
    cols,
    shape: SHAPES[n % SHAPES.length],
    snakeCount,
    minLen: t < 0.4 ? 2 : 3,
    maxLen: t < 0.33 ? 4 : t < 0.7 ? 5 : 6,
    colorCount,
    scrambleMoves: Math.round(10 + t * 55),
    id: n,
    titleFr: `Niveau ${n}`,
    titleEn: `Level ${n}`,
  });
}

/** Défi quotidien : graine dérivée de la date (AAAA-MM-JJ), même niveau pour tous. */
export function dailyLevelForDate(dateStr: string): LevelDef {
  const dayIndex = Math.floor(seedFromString(dateStr) % 365);
  return generateLevel({
    seed: seedFromString(`daily-${dateStr}`),
    rows: 7,
    cols: 6,
    shape: SHAPES[dayIndex % SHAPES.length],
    snakeCount: 5,
    minLen: 3,
    maxLen: 5,
    colorCount: 5,
    scrambleMoves: 34,
    id: `daily-${dateStr}`,
    titleFr: 'Défi du jour',
    titleEn: 'Daily challenge',
    daily: true,
  });
}
