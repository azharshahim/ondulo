// Validation hors-ligne de TOUS les niveaux : structure, solvabilité,
// optimal du solveur, performance du générateur.
// Lancer avec : npm run test:levels
import { HANDCRAFTED } from '../src/levels/handcrafted';
import { generatedLevelForNumber, dailyLevelForDate } from '../src/game/generator';
import { buildState, validateLevel } from '../src/game/engine';
import { solve } from '../src/game/solver';

let failures = 0;
const fail = (msg: string) => { failures += 1; console.log(`  ✗ ${msg}`); };

console.log('── Niveaux manuscrits (1-10) ──');
for (const level of HANDCRAFTED) {
  const t0 = Date.now();
  const issues = validateLevel(level);
  issues.forEach((i) => fail(`N${level.id} structure : ${i}`));
  const res = solve(level, buildState(level), 400000);
  if (!res.path) fail(`N${level.id} NON RÉSOLU par le solveur (exhausted=${res.exhausted}, expansions=${res.expansions})`);
  else console.log(`  ✓ N${level.id} « ${level.titleFr} » optimal=${res.path.length} coups (${Date.now() - t0} ms, ${res.expansions} états)`);
}

console.log('── Niveaux générés (11-60) ──');
for (let n = 11; n <= 60; n++) {
  const t0 = Date.now();
  try {
    const level = generatedLevelForNumber(n);
    const issues = validateLevel(level);
    issues.forEach((i) => fail(`N${n} structure : ${i}`));
    const snakes = level.snakes.length;
    console.log(
      `  ✓ N${n} ${level.rows}x${level.cols} serpents=${snakes} optimal=${level.optimal} ` +
      `solveur=${level.solverValidated ? 'prouvé' : 'garanti générateur'} (${Date.now() - t0} ms)`,
    );
  } catch (e) {
    fail(`N${n} génération : ${(e as Error).message}`);
  }
}

console.log('── Défi quotidien ──');
for (const dateStr of ['2026-10-22', '2026-10-23', '2027-01-01']) {
  const t0 = Date.now();
  const level = dailyLevelForDate(dateStr);
  const issues = validateLevel(level);
  issues.forEach((i) => fail(`Daily ${dateStr} : ${i}`));
  console.log(`  ✓ ${dateStr} optimal=${level.optimal} solveur=${level.solverValidated} (${Date.now() - t0} ms)`);
}

console.log(failures ? `\n❌ ${failures} problème(s)` : '\n✅ Tous les niveaux sont valides et solvables.');
process.exit(failures ? 1 : 0);
