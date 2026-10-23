// ─── Solveur BFS / A* ──────────────────────────────────────────────────────
// Recherche du plus court chemin (chaque déplacement d'une case = 1 coup).
// A* avec heuristique admissible : pour chaque serpent restant, distance de
// Manhattan de son extrémité la plus proche vers un trou libre de sa couleur.
// Un coup ne peut réduire cette somme que d'au plus 1, donc l'heuristique ne
// surestime jamais → le premier chemin trouvé est optimal (comme un BFS,
// mais beaucoup plus rapide). Utilisé pour :
//   • valider que chaque niveau est solvable ;
//   • calculer le nombre de coups optimal (étoiles) ;
//   • fournir les indices en cours de partie.
import type { GameState, LevelDef, Move } from './types';
import {
  applyMove, DIRS, getEndCell, isWin, legalMoves, manhattan, stateKey, tryMove,
} from './engine';

export interface SolveResult {
  /** Chemin optimal (null si introuvable dans la limite). */
  path: Move[] | null;
  /** Nombre d'états développés. */
  expansions: number;
  /** Vrai si la recherche a été interrompue par la limite d'expansions. */
  exhausted: boolean;
}

/** Somme des distances extrémité→trou : borne inférieure du nombre de coups restants. */
export function heuristic(state: GameState): number {
  let h = 0;
  for (const snake of state.snakes) {
    if (snake.absorbed) continue;
    const head = snake.cells[0];
    const tail = snake.cells[snake.cells.length - 1];
    let best = Infinity;
    for (const hole of state.trous) {
      if (hole.filled || hole.color !== snake.color) continue;
      best = Math.min(best, manhattan(head, hole.cell), manhattan(tail, hole.cell));
    }
    if (best !== Infinity) h += best;
  }
  return h;
}

// Petit tas binaire pour la file de priorité d'A*.
class Heap<T> {
  private items: { p: number; v: T }[] = [];
  get size() { return this.items.length; }
  push(p: number, v: T) {
    const a = this.items;
    a.push({ p, v });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].p <= a[i].p) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0].v;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, rgt = l + 1;
        let smallest = i;
        if (l < a.length && a[l].p < a[smallest].p) smallest = l;
        if (rgt < a.length && a[rgt].p < a[smallest].p) smallest = rgt;
        if (smallest === i) break;
        [a[smallest], a[i]] = [a[i], a[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

interface NodeInfo {
  parentKey: string | null;
  move: Move | null;
  state: GameState;
  g: number;
}

/**
 * Résout un niveau depuis un état donné.
 * @param maxExpansions garde-fou pour les grands plateaux (états développés max).
 */
export function solve(
  level: LevelDef,
  initial: GameState,
  maxExpansions = 60000,
): SolveResult {
  if (isWin(initial)) return { path: [], expansions: 0, exhausted: false };
  const open = new Heap<string>();
  const nodes = new Map<string, NodeInfo>();
  const startKey = stateKey(initial);
  nodes.set(startKey, { parentKey: null, move: null, state: initial, g: 0 });
  open.push(heuristic(initial), startKey);
  const closed = new Set<string>();
  let expansions = 0;

  while (open.size) {
    const currentKey = open.pop()!;
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    const node = nodes.get(currentKey)!;
    if (isWin(node.state)) {
      // Reconstruction du chemin.
      const path: Move[] = [];
      let k: string | null = currentKey;
      while (k) {
        const n: NodeInfo = nodes.get(k)!;
        if (n.move) path.unshift(n.move);
        k = n.parentKey;
      }
      return { path, expansions, exhausted: false };
    }
    if (expansions >= maxExpansions) return { path: null, expansions, exhausted: true };
    expansions += 1;
    // Un seul appel à tryMove par successeur (il renvoie directement le nouvel état).
    for (const snake of node.state.snakes) {
      if (snake.absorbed) continue;
      for (const end of ['head', 'tail'] as const) {
        const from = getEndCell(snake, end);
        for (const d of DIRS) {
          const target = { r: from.r + d.dr, c: from.c + d.dc };
          const res = tryMove(level, node.state, snake.id, end, target);
          if (res.status === 'blocked') continue;
          const nextKey = stateKey(res.state);
          const g = node.g + 1;
          const existing = nodes.get(nextKey);
          if (existing && existing.g <= g) continue;
          nodes.set(nextKey, {
            parentKey: currentKey,
            move: { snakeId: snake.id, end, target },
            state: res.state, g,
          });
          open.push(g + heuristic(res.state), nextKey);
        }
      }
    }
  }
  return { path: null, expansions, exhausted: false };
}

/**
 * Indice : prochain bon coup depuis l'état courant.
 * 1) chemin optimal A* ; 2) repli glouton : le coup qui réduit le plus
 *    l'heuristique sans créer d'impasse immédiate évidente.
 */
export function findHint(
  level: LevelDef,
  state: GameState,
  maxExpansions = 30000,
): Move | null {
  const res = solve(level, state, maxExpansions);
  if (res.path && res.path.length) return res.path[0];
  // Repli glouton (grands plateaux où A* dépasse la limite).
  let best: Move | null = null;
  let bestScore = Infinity;
  for (const move of legalMoves(level, state)) {
    const next = applyMove(level, state, move);
    // Petit bonus si une extrémité se rapproche de son trou.
    const score = heuristic(next);
    if (score < bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

/** Exposé pour l'affichage (case de l'extrémité concernée par un coup). */
export function moveSourceCell(state: GameState, move: Move) {
  const snake = state.snakes.find((s) => s.id === move.snakeId);
  return snake && !snake.absorbed ? getEndCell(snake, move.end) : null;
}
