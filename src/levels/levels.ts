// ─── Assemblage des 60 niveaux ─────────────────────────────────────────────
// Niveaux 1-10 : écrits à la main (handcrafted.ts), leur optimal est calculé
// par le solveur A* au premier chargement. Niveaux 11-60 : générés de façon
// déterministe (generator.ts) puis mis en cache mémoire.
import type { LevelDef } from '../game/types';
import { HANDCRAFTED } from './handcrafted';
import { dailyLevelForDate, generatedLevelForNumber } from '../game/generator';
import { buildState } from '../game/engine';
import { solve } from '../game/solver';

export const TOTAL_LEVELS = 60;

const cache = new Map<number, LevelDef>();
const dailyCache = new Map<string, LevelDef>();
let handcraftedPrepared = false;

/** Calcule l'optimal des niveaux manuscrits avec le solveur (une seule fois). */
function prepareHandcrafted(): void {
  if (handcraftedPrepared) return;
  handcraftedPrepared = true;
  for (const level of HANDCRAFTED) {
    const res = solve(level, buildState(level), 200000);
    if (res.path) {
      level.optimal = res.path.length;
      level.solverValidated = true;
      level.solution = res.path;
    }
    cache.set(level.id as number, level);
  }
}

export function getLevel(n: number): LevelDef {
  prepareHandcrafted();
  const cached = cache.get(n);
  if (cached) return cached;
  const level = generatedLevelForNumber(n);
  cache.set(n, level);
  return level;
}

export function getDailyLevel(date: Date = new Date()): LevelDef {
  const dateStr = date.toISOString().slice(0, 10); // AAAA-MM-JJ
  const cached = dailyCache.get(dateStr);
  if (cached) return cached;
  const level = dailyLevelForDate(dateStr);
  dailyCache.set(dateStr, level);
  return level;
}

export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
