// ─── Moteur de règles (pur TypeScript, aucun import React Native) ──────────
// Règles implémentées :
//  • on saisit la tête OU la queue ; le corps suit, segment par segment ;
//  • déplacement case par case, uniquement vers une case libre et jouable ;
//  • un trou d'une autre couleur bloque ; un trou de SA couleur absorbe
//    entièrement le serpent (un seul serpent par trou) ;
//  • victoire quand tous les serpents sont rentrés.
import type {
  Cell, End, GameState, LevelDef, Move, MoveResult, SnakeState,
} from './types';

export const DIRS: { dr: number; dc: number; name: string }[] = [
  { dr: -1, dc: 0, name: 'up' },
  { dr: 1, dc: 0, name: 'down' },
  { dr: 0, dc: -1, name: 'left' },
  { dr: 0, dc: 1, name: 'right' },
];

export const keyOf = (r: number, c: number) => `${r},${c}`;
export const sameCell = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;
export const manhattan = (a: Cell, b: Cell) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

export function isPlayable(level: LevelDef, r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < level.rows && c < level.cols && level.grid[r]?.[c] === 1;
}

export function buildState(level: LevelDef): GameState {
  return {
    snakes: level.snakes.map((s) => ({
      id: s.id, color: s.color, absorbed: false,
      cells: s.cells.map((c) => ({ ...c })),
    })),
    trous: level.trous.map((h) => ({ ...h, cell: { ...h.cell }, filled: false })),
    moves: 0,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    moves: state.moves,
    snakes: state.snakes.map((s) => ({ ...s, cells: s.cells.map((c) => ({ ...c })) })),
    trous: state.trous.map((h) => ({ ...h, cell: { ...h.cell } })),
  };
}

/** Carte case → id du serpent qui l'occupe (serpents non rentrés uniquement). */
export function occupancy(state: GameState): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of state.snakes) {
    if (s.absorbed) continue;
    for (const cell of s.cells) map.set(keyOf(cell.r, cell.c), s.id);
  }
  return map;
}

export function holeAt(state: GameState, r: number, c: number) {
  return state.trous.find((h) => !h.filled && h.cell.r === r && h.cell.c === c);
}

/**
 * Invariante de sécurité : retourne une description si une même case
 * appartient à deux serpents (ou deux fois au même), sinon null.
 * Les serpents NE DOIVENT JAMAIS se superposer.
 */
export function detectOverlap(state: GameState): string | null {
  const seen = new Map<string, string>();
  for (const s of state.snakes) {
    if (s.absorbed) continue;
    for (const cell of s.cells) {
      const k = keyOf(cell.r, cell.c);
      const other = seen.get(k);
      if (other) return `case ${k} partagée par ${other} et ${s.id}`;
      seen.set(k, s.id);
    }
  }
  return null;
}

const isDev = (): boolean =>
  (globalThis as { __DEV__?: boolean }).__DEV__ === true;

export function getEndCell(snake: SnakeState, end: End): Cell {
  return end === 'head' ? snake.cells[0] : snake.cells[snake.cells.length - 1];
}

/**
 * Tente de déplacer une extrémité d'un serpent vers la case `target`
 * (qui doit être adjacente). Ne mute pas l'état d'origine.
 */
export function tryMove(
  level: LevelDef,
  state: GameState,
  snakeId: string,
  end: End,
  target: Cell,
): MoveResult {
  const snake = state.snakes.find((s) => s.id === snakeId);
  if (!snake) return { status: 'blocked', reason: 'inconnu' };
  if (snake.absorbed) return { status: 'blocked', reason: 'deja-rentre' };

  const from = getEndCell(snake, end);
  if (manhattan(from, target) !== 1) return { status: 'blocked', reason: 'non-adjacent' };
  if (target.r < 0 || target.c < 0 || target.r >= level.rows || target.c >= level.cols) {
    return { status: 'blocked', reason: 'hors-grille' };
  }
  if (!isPlayable(level, target.r, target.c)) return { status: 'blocked', reason: 'case-vide' };

  // Trou ? (un trou déjà rempli redevient une case normale)
  const hole = holeAt(state, target.r, target.c);
  if (hole) {
    if (hole.color !== snake.color) return { status: 'blocked', reason: 'trou-autre-couleur' };
    // Absorption complète du serpent dans son trou.
    const next = cloneState(state);
    const ns = next.snakes.find((s) => s.id === snakeId)!;
    ns.absorbed = true;
    ns.cells = [];
    const nh = next.trous.find((h) => h.id === hole.id)!;
    nh.filled = true;
    next.moves += 1;
    return { status: 'absorbed', state: next, move: { snakeId, end, target }, holeId: hole.id };
  }

  // Occupation : calculée sur l'état AVANT le pas. Une case occupée par un
  // AUTRE serpent (tête, corps ou queue) est infranchissable. Le propre
  // corps bloque aussi, sauf la case de l'extrémité opposée du serpent qui
  // bouge : elle se libère pendant ce même pas (la queue recule au moment
  // où la tête avance), donc aucune superposition n'existe ni avant ni
  // après le pas. Pour tout autre serpent, cette case reste occupée.
  const occ = occupancy(state);
  const occupant = occ.get(keyOf(target.r, target.c));
  if (occupant) {
    const vacating = end === 'head' ? snake.cells[snake.cells.length - 1] : snake.cells[0];
    if (occupant !== snakeId || !sameCell(target, vacating)) {
      return { status: 'blocked', reason: 'occupe' };
    }
  }

  const next = cloneState(state);
  const ns = next.snakes.find((s) => s.id === snakeId)!;
  if (end === 'head') {
    // La tête avance, chaque segment prend la place du précédent.
    ns.cells = [{ ...target }, ...ns.cells.slice(0, -1).map((c) => ({ ...c }))];
  } else {
    // La queue avance (marche arrière) : le corps suit dans l'autre sens.
    ns.cells = [...ns.cells.slice(1).map((c) => ({ ...c })), { ...target }];
  }
  next.moves += 1;

  // Invariante de sécurité : si le nouvel état superposait deux serpents,
  // on annule le mouvement (et on le signale en développement).
  const overlap = detectOverlap(next);
  if (overlap) {
    if (isDev()) console.error(`[engine] mouvement annulé : ${overlap}`);
    return { status: 'blocked', reason: 'occupe' };
  }
  return { status: 'moved', state: next, move: { snakeId, end, target } };
}

/** Tous les coups légaux depuis un état (utilisé par le solveur et le générateur). */
export function legalMoves(level: LevelDef, state: GameState): Move[] {
  const moves: Move[] = [];
  for (const snake of state.snakes) {
    if (snake.absorbed) continue;
    for (const end of ['head', 'tail'] as End[]) {
      const from = getEndCell(snake, end);
      for (const d of DIRS) {
        const target = { r: from.r + d.dr, c: from.c + d.dc };
        const res = tryMove(level, state, snake.id, end, target);
        if (res.status !== 'blocked') moves.push(res.move);
      }
    }
  }
  return moves;
}

export function applyMove(level: LevelDef, state: GameState, move: Move): GameState {
  const res = tryMove(level, state, move.snakeId, move.end, move.target);
  return res.status === 'blocked' ? state : res.state;
}

/**
 * Prochain pas d'un glisser vers une case doigt : fonction PARTAGÉE entre
 * l'interface (Board) et les tests. Elle ne propose que des pas qui
 * rapprochent l'extrémité de la case visée, et chaque pas candidat est
 * validé par tryMove (la seule source de vérité). Retourne null si aucun
 * pas n'est possible : le serpent reste bloqué là où il est.
 */
export function nextDragStep(
  level: LevelDef,
  state: GameState,
  snakeId: string,
  end: End,
  fingerCell: Cell,
): Move | null {
  const snake = state.snakes.find((s) => s.id === snakeId);
  if (!snake || snake.absorbed) return null;
  const from = getEndCell(snake, end);
  const currentDist = manhattan(from, fingerCell);
  if (currentDist === 0) return null;
  const candidates = DIRS
    .map((d) => ({ r: from.r + d.dr, c: from.c + d.dc }))
    .filter((t) => manhattan(t, fingerCell) < currentDist)
    .sort((a, b) => {
      const byDist = manhattan(a, fingerCell) - manhattan(b, fingerCell);
      if (byDist !== 0) return byDist;
      // À distance égale, privilégier l'axe dominant du glisser.
      const dominantR = Math.abs(fingerCell.r - from.r) >= Math.abs(fingerCell.c - from.c);
      const score = (t: Cell) => (dominantR ? (t.r !== from.r ? 0 : 1) : (t.c !== from.c ? 0 : 1));
      return score(a) - score(b);
    });
  for (const target of candidates) {
    const res = tryMove(level, state, snakeId, end, target);
    if (res.status !== 'blocked') return res.move;
  }
  return null;
}

export interface DragResult {
  state: GameState;
  /** Pas effectivement appliqués, un par case. */
  moves: Move[];
  /** Id du trou si le glisser s'est terminé par une absorption. */
  absorbedHoleId?: string;
  /** Vrai si le serpent s'est arrêté avant la case visée (obstacle). */
  stopped: boolean;
}

/**
 * Glisser complet, STRICTEMENT case par case : applique les pas un par un
 * via nextDragStep + tryMove et s'arrête au premier pas interdit, même si
 * la case visée est encore loin (drag très rapide). Utilisé par les tests
 * automatisés ; l'interface applique la même boucle via attemptMove.
 */
export function dragToward(
  level: LevelDef,
  initial: GameState,
  snakeId: string,
  end: End,
  fingerCell: Cell,
  maxSteps = 99,
): DragResult {
  let state = initial;
  const moves: Move[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const snakeNow = state.snakes.find((s) => s.id === snakeId);
    if (!snakeNow || snakeNow.absorbed) break;
    if (manhattan(getEndCell(snakeNow, end), fingerCell) === 0) {
      return { state, moves, stopped: false };
    }
    const step = nextDragStep(level, state, snakeId, end, fingerCell);
    if (!step) return { state, moves, stopped: true };
    const res = tryMove(level, state, step.snakeId, step.end, step.target);
    if (res.status === 'blocked') return { state, moves, stopped: true };
    state = res.state;
    moves.push(res.move);
    if (res.status === 'absorbed') {
      return { state, moves, absorbedHoleId: res.holeId, stopped: false };
    }
    const snake = state.snakes.find((s) => s.id === snakeId);
    if (!snake || snake.absorbed) break;
    if (manhattan(getEndCell(snake, end), fingerCell) === 0) {
      return { state, moves, stopped: false };
    }
  }
  return { state, moves, stopped: moves.length === 0 };
}

export function isWin(state: GameState): boolean {
  return state.snakes.every((s) => s.absorbed);
}

/** Clé canonique d'un état pour le solveur (détection des doublons). */
export function stateKey(state: GameState): string {
  const snakes = state.snakes
    .map((s) => (s.absorbed ? 'X' : s.cells.map((c) => keyOf(c.r, c.c)).join('>')))
    .join('|');
  const trous = state.trous.filter((h) => h.filled).map((h) => h.id).sort().join(',');
  return `${snakes}#${trous}`;
}

/** Étoiles selon le nombre de coups comparé à l'optimal (1 à 3). */
export function starsForMoves(moves: number, optimal: number): number {
  if (moves <= Math.ceil(optimal * 1.15)) return 3;
  if (moves <= Math.ceil(optimal * 1.6)) return 2;
  return 1;
}

/** Validation structurelle d'un niveau : retourne la liste des problèmes (vide = OK). */
export function validateLevel(level: LevelDef): string[] {
  const issues: string[] = [];
  if (level.grid.length !== level.rows || level.grid.some((row) => row.length !== level.cols)) {
    issues.push('dimensions de grille incohérentes');
  }
  const seen = new Map<string, string>();
  for (const snake of level.snakes) {
    if (snake.cells.length < 2 || snake.cells.length > 6) {
      issues.push(`serpent ${snake.id} : longueur ${snake.cells.length} hors limites 2..6`);
    }
    snake.cells.forEach((cell, i) => {
      if (!isPlayable(level, cell.r, cell.c)) issues.push(`serpent ${snake.id} sur case non jouable ${keyOf(cell.r, cell.c)}`);
      const k = keyOf(cell.r, cell.c);
      if (seen.has(k)) issues.push(`case ${k} partagée par ${seen.get(k)} et ${snake.id}`);
      seen.set(k, snake.id);
      if (i > 0 && manhattan(snake.cells[i - 1], cell) !== 1) {
        issues.push(`serpent ${snake.id} non contigu entre segments ${i - 1} et ${i}`);
      }
    });
  }
  const holeCells = new Set<string>();
  for (const hole of level.trous) {
    const k = keyOf(hole.cell.r, hole.cell.c);
    if (!isPlayable(level, hole.cell.r, hole.cell.c)) issues.push(`trou ${hole.id} sur case non jouable ${k}`);
    if (seen.has(k)) issues.push(`trou ${hole.id} sur un serpent (${k})`);
    if (holeCells.has(k)) issues.push(`deux trous sur la case ${k}`);
    holeCells.add(k);
  }
  // Chaque serpent doit avoir exactement un trou de sa couleur disponible.
  const countBy = (arr: { color: string }[]) =>
    arr.reduce<Record<string, number>>((acc, x) => ((acc[x.color] = (acc[x.color] ?? 0) + 1), acc), {});
  const sc = countBy(level.snakes);
  const hc = countBy(level.trous);
  for (const color of Object.keys(sc)) {
    if (sc[color] !== (hc[color] ?? 0)) {
      issues.push(`couleur ${color} : ${sc[color]} serpent(s) mais ${hc[color] ?? 0} trou(s)`);
    }
  }
  return issues;
}
