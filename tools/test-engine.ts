// ─── Tests automatisés du moteur (npm run test:engine) ─────────────────────
// Vérifie la règle critique : les serpents ne se superposent JAMAIS.
//  1. collision tête / queue contre un autre serpent (tête, corps, queue) ;
//  2. drag très rapide : le serpent s'arrête devant l'obstacle ;
//  3. trou d'une autre couleur infranchissable ;
//  4. absorption par la tête et par la queue dans son trou ;
//  5. 10 000 mouvements aléatoires sur les 60 niveaux + défi quotidien.
import type { Cell, ColorId, LevelDef, SnakeDef, HoleDef } from '../src/game/types';
import {
  buildState, detectOverlap, dragToward, getEndCell, isPlayable, legalMoves,
  manhattan, stateKey, tryMove,
} from '../src/game/engine';
import { getDailyLevel, getLevel } from '../src/levels/levels';
import { mulberry32 } from '../src/game/generator';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
}

const S = (id: string, color: ColorId, pts: [number, number][]): SnakeDef => ({
  id, color, cells: pts.map(([r, c]) => ({ r, c })),
});
const H = (id: string, color: ColorId, r: number, c: number): HoleDef => ({ id, color, cell: { r, c } });
function lvl(snakes: SnakeDef[], trous: HoleDef[], rows = 5, cols = 5): LevelDef {
  return {
    id: 'test', titleFr: 'test', titleEn: 'test', rows, cols,
    grid: Array.from({ length: rows }, () => Array(cols).fill(1)),
    snakes, trous, optimal: 0, solverValidated: false,
  };
}

console.log('── Collisions entre serpents ──');
{
  // Tête contre le CORPS d'un autre serpent.
  const level = lvl([S('a', 'corail', [[1, 1], [1, 2], [1, 3]]), S('b', 'azur', [[0, 0], [1, 0], [2, 0]])], []);
  const st = buildState(level);
  const res = tryMove(level, st, 'a', 'head', { r: 1, c: 0 });
  check('tête → corps d\u2019un autre serpent : bloqué', res.status === 'blocked' && res.reason === 'occupe', JSON.stringify(res));
  check('état inchangé après blocage', stateKey(st) === stateKey(buildState(level)));
}
{
  // Tête contre la TÊTE d'un autre serpent.
  const level = lvl([S('a', 'corail', [[1, 1], [1, 2]]), S('b', 'azur', [[1, 0], [2, 0]])], []);
  const res = tryMove(level, buildState(level), 'a', 'head', { r: 1, c: 0 });
  check('tête → tête d\u2019un autre serpent : bloqué', res.status === 'blocked');
}
{
  // Tête contre la QUEUE d'un autre serpent (la queue d'autrui n'est pas libre).
  const level = lvl([S('a', 'corail', [[4, 3], [4, 2]]), S('b', 'azur', [[2, 4], [3, 4], [4, 4]])], []);
  const res = tryMove(level, buildState(level), 'a', 'head', { r: 4, c: 4 });
  check('tête → queue d\u2019un autre serpent : bloqué', res.status === 'blocked' && res.reason === 'occupe');
}
{
  // Queue contre un autre serpent.
  const level = lvl([S('a', 'corail', [[3, 1], [3, 2], [3, 3]]), S('b', 'azur', [[3, 4], [2, 4], [1, 4]])], []);
  const res = tryMove(level, buildState(level), 'a', 'tail', { r: 3, c: 4 });
  check('queue → autre serpent : bloqué', res.status === 'blocked' && res.reason === 'occupe');
}
{
  // Propre corps (cou) infranchissable aussi.
  const level = lvl([S('a', 'corail', [[1, 1], [1, 2], [1, 3]])], []);
  const res = tryMove(level, buildState(level), 'a', 'head', { r: 1, c: 2 });
  check('tête → son propre cou : bloqué', res.status === 'blocked');
}

console.log('── Drag très rapide (case par case, arrêt devant l\u2019obstacle) ──');
{
  const level = lvl(
    [S('a', 'corail', [[3, 2], [3, 1], [3, 0]]), S('b', 'azur', [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5]])],
    [], 6, 8,
  );
  const st = buildState(level);
  // Le doigt « saute » directement à l'autre bout du plateau, derrière B.
  const drag = dragToward(level, st, 'a', 'head', { r: 3, c: 7 }, 99);
  const a = drag.state.snakes.find((s) => s.id === 'a')!;
  check('le serpent s\u2019est arrêté (stopped)', drag.stopped === true);
  check('tête arrêtée juste devant l\u2019obstacle (3,4)', a.cells[0].r === 3 && a.cells[0].c === 4, JSON.stringify(a.cells[0]));
  check('2 pas appliqués seulement', drag.moves.length === 2, `${drag.moves.length}`);
  check('aucune superposition après drag rapide', detectOverlap(drag.state) === null);
  // Le doigt continue : nouveau drag, le serpent ne bouge toujours pas.
  const drag2 = dragToward(level, drag.state, 'a', 'head', { r: 3, c: 7 }, 99);
  check('doigt qui continue : aucun pas de plus', drag2.moves.length === 0);
  check('toujours aucune superposition', detectOverlap(drag2.state) === null);
}

console.log('── Trous ──');
{
  const level = lvl([S('a', 'corail', [[2, 1], [2, 2], [2, 3]])], [H('h1', 'azur', 2, 0), H('h2', 'corail', 2, 4)]);
  const res = tryMove(level, buildState(level), 'a', 'head', { r: 2, c: 0 });
  check('trou d\u2019une autre couleur : bloqué', res.status === 'blocked' && res.reason === 'trou-autre-couleur');
}
{
  const level = lvl([S('a', 'corail', [[2, 1], [2, 2], [2, 3]])], [H('h1', 'corail', 2, 0)]);
  const res = tryMove(level, buildState(level), 'a', 'head', { r: 2, c: 0 });
  check('absorption par la tête', res.status === 'absorbed');
  if (res.status === 'absorbed') {
    const a = res.state.snakes.find((s) => s.id === 'a')!;
    check('serpent rentré (absorbed, 0 case)', a.absorbed && a.cells.length === 0);
    check('trou rempli', res.state.trous[0].filled === true);
  }
}
{
  const level = lvl([S('a', 'corail', [[2, 1], [2, 2], [2, 3]])], [H('h1', 'corail', 2, 4)]);
  const res = tryMove(level, buildState(level), 'a', 'tail', { r: 2, c: 4 });
  check('absorption par la queue', res.status === 'absorbed');
}

console.log('── Invariante de sécurité ──');
{
  const level = lvl([S('a', 'corail', [[1, 1], [1, 2]]), S('b', 'azur', [[3, 3], [3, 4]])], []);
  const st = buildState(level);
  check('état sain : pas de superposition', detectOverlap(st) === null);
  st.snakes[1].cells[0] = { ...st.snakes[0].cells[0] }; // corruption volontaire
  check('superposition fabriquée : détectée', detectOverlap(st) !== null);
}

console.log('── 10 000 mouvements aléatoires (60 niveaux + quotidien) ──');
{
  const rng = mulberry32(20261023);
  const levels: LevelDef[] = [];
  for (let n = 1; n <= 60; n++) levels.push(getLevel(n));
  levels.push(getDailyLevel(new Date('2026-10-23T12:00:00Z')));
  const states = new Map<string, ReturnType<typeof buildState>>();
  const defLen = new Map<string, number>();
  for (const l of levels) {
    states.set(String(l.id), buildState(l));
    l.snakes.forEach((s) => defLen.set(`${l.id}:${s.id}`, s.cells.length));
  }
  let applied = 0;
  let blocked = 0;
  let guard = 0;
  while (applied < 10000 && guard < 300000) {
    guard++;
    const level = levels[Math.floor(rng() * levels.length)];
    let st = states.get(String(level.id))!;
    const legal = legalMoves(level, st);
    if (!legal.length) { st = buildState(level); states.set(String(level.id), st); continue; }
    if (rng() < 0.75) {
      // Mouvement légal au hasard.
      const move = legal[Math.floor(rng() * legal.length)];
      const res = tryMove(level, st, move.snakeId, move.end, move.target);
      if (res.status === 'blocked') { failed++; console.log(`  ✗ mouvement légal refusé (${move.snakeId})`); break; }
      st = res.state;
      applied++;
    } else {
      // Tentative brute au hasard (souvent bloquée : c'est le but).
      const alive = st.snakes.filter((s) => !s.absorbed);
      if (!alive.length) { states.set(String(level.id), buildState(level)); continue; }
      const snake = alive[Math.floor(rng() * alive.length)];
      const end = rng() < 0.5 ? 'head' as const : 'tail' as const;
      const from = getEndCell(snake, end);
      const d = [[-1, 0], [1, 0], [0, -1], [0, 1]][Math.floor(rng() * 4)];
      const target: Cell = { r: from.r + d[0], c: from.c + d[1] };
      const res = tryMove(level, st, snake.id, end, target);
      if (res.status === 'blocked') { blocked++; continue; }
      st = res.state;
      applied++;
    }
    states.set(String(level.id), st);
    // Invariantes après CHAQUE mouvement appliqué.
    const overlap = detectOverlap(st);
    if (overlap) { failed++; console.log(`  ✗ superposition niveau ${level.id} : ${overlap}`); break; }
    let ok = true;
    for (const s of st.snakes) {
      if (s.absorbed) { if (s.cells.length !== 0) ok = false; continue; }
      if (s.cells.length !== defLen.get(`${level.id}:${s.id}`)) ok = false;
      s.cells.forEach((c, i) => {
        if (!isPlayable(level, c.r, c.c)) ok = false;
        if (i > 0 && manhattan(s.cells[i - 1], c) !== 1) ok = false;
      });
    }
    if (!ok) { failed++; console.log(`  ✗ invariant de forme violé niveau ${level.id}`); break; }
  }
  check(`10 000 mouvements appliqués sans superposition (${applied} appliqués, ${blocked} bloqués)`, applied >= 10000);
}

console.log(failed ? `\n❌ ${failed} échec(s), ${passed} succès` : `\n✅ Moteur : ${passed} vérifications réussies, aucune superposition.`);
process.exit(failed ? 1 : 0);
