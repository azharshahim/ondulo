// ─── Service « code parental » (logique pure, testable hors app) ───────────
// Toute la logique (hachage, migration, verrouillage progressif) vit ici ;
// src/state/pin.ts ne fait que brancher le stockage natif (SecureStore) et
// la source d'aléa d'expo-crypto. Aucun import natif dans ce fichier.
import {
  hashPinNew, verifyHashNew, isModernHash, isLegacyHash, legacyHash,
  type defaultRandomBytes,
} from './pinCrypto';

export interface PinStorage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<void>;
}

export interface PinServiceDeps {
  storage: PinStorage;
  /** Horloge injectable (ms epoch) — permet de simuler le temps dans les tests. */
  now?: () => number;
  /** Source d'aléa (expo-crypto côté app). */
  randomBytes?: typeof defaultRandomBytes;
  /** Digest SHA-256 hexadécimal, utilisé UNIQUEMENT pour la migration v1. */
  digestHex?: (input: string) => Promise<string>;
}

export const PIN_KEYS = {
  hash: 'ondulo_pin_hash',
  fails: 'ondulo_pin_fails',
  lockedUntil: 'ondulo_pin_locked_until',
  lockCount: 'ondulo_pin_lock_count',
} as const;

/** Échecs consécutifs avant le premier verrouillage. */
export const FAILS_BEFORE_LOCK = 5;
/** Durée du premier verrouillage (ms) : 30 s, puis doublement à chaque fois. */
export const FIRST_LOCK_MS = 30_000;
/** Plafond du verrouillage (ms). */
export const MAX_LOCK_MS = 8 * 60_000;

/**
 * Durée de verrouillage après `fails` échecs consécutifs et `lockCount`
 * verrouillages déjà subis : 30 s, 60 s, 120 s, 240 s, 480 s (plafond).
 * Renvoie 0 tant que le seuil d'échecs n'est pas atteint.
 */
export function lockMsFor(fails: number, lockCount: number): number {
  if (fails < FAILS_BEFORE_LOCK) return 0;
  const step = Math.min(Math.max(lockCount, 0), 10);
  return Math.min(FIRST_LOCK_MS * Math.pow(2, step), MAX_LOCK_MS);
}

export interface PinCheckResult {
  ok: boolean;
  /** Vrai si le verrouillage progressif est actif après cette tentative. */
  locked: boolean;
  /** Fin du verrouillage (ms epoch), 0 si non verrouillé. */
  lockedUntil: number;
  /** Tentatives restantes avant le prochain verrouillage. */
  failsLeft: number;
  /** Vrai si l'ancien hachage v1 a été migré vers PBKDF2 pendant cet appel. */
  migrated: boolean;
}

export function createPinService(deps: PinServiceDeps) {
  const now = deps.now ?? (() => Date.now());

  const read = async (key: string): Promise<string | null> => deps.storage.get(key);

  async function getPinHash(): Promise<string | null> {
    return read(PIN_KEYS.hash);
  }

  async function storePinHash(hashed: string): Promise<void> {
    await deps.storage.set(PIN_KEYS.hash, hashed);
  }

  async function hasPin(): Promise<boolean> {
    return (await getPinHash()) !== null;
  }

  /** Définit (ou remplace) le code parental. 4 à 6 chiffres exigés. */
  async function setPin(pin: string): Promise<boolean> {
    if (!/^\d{4,6}$/.test(pin)) return false;
    await storePinHash(hashPinNew(pin, deps.randomBytes));
    await resetPinFails();
    return true;
  }

  async function clearPinHash(): Promise<void> {
    await deps.storage.del(PIN_KEYS.hash);
  }

  async function getPinStatus(): Promise<{ fails: number; lockedUntil: number; lockCount: number }> {
    const fails = Number(await read(PIN_KEYS.fails)) || 0;
    const lockedUntil = Number(await read(PIN_KEYS.lockedUntil)) || 0;
    const lockCount = Number(await read(PIN_KEYS.lockCount)) || 0;
    return { fails, lockedUntil, lockCount };
  }

  async function resetPinFails(): Promise<void> {
    await deps.storage.set(PIN_KEYS.fails, '0');
    await deps.storage.set(PIN_KEYS.lockedUntil, '0');
    await deps.storage.set(PIN_KEYS.lockCount, '0');
  }

  async function isPinLocked(): Promise<boolean> {
    const { lockedUntil } = await getPinStatus();
    return now() < lockedUntil;
  }

  /**
   * Vérifie un PIN sans tenir compte du verrouillage (usage interne).
   * Migre automatiquement un hachage v1 correct vers PBKDF2.
   */
  async function verifyPin(pin: string): Promise<{ ok: boolean; migrated: boolean }> {
    const stored = await getPinHash();
    if (!stored) return { ok: false, migrated: false };

    if (isModernHash(stored)) {
      return { ok: verifyHashNew(pin, stored), migrated: false };
    }
    if (isLegacyHash(stored) && deps.digestHex) {
      const legacy = await legacyHash(pin, deps.digestHex);
      if (legacy.toLowerCase() !== stored.toLowerCase()) return { ok: false, migrated: false };
      // PIN correct sur l'ancien schéma : on réécrit immédiatement en v2.
      await storePinHash(hashPinNew(pin, deps.randomBytes));
      return { ok: true, migrated: true };
    }
    return { ok: false, migrated: false };
  }

  /** Point d'entrée unique de l'interface : vérification + verrouillage. */
  async function checkPin(pin: string): Promise<PinCheckResult> {
    const { lockedUntil, lockCount } = await getPinStatus();
    if (now() < lockedUntil) {
      return { ok: false, locked: true, lockedUntil, failsLeft: 0, migrated: false };
    }
    const { ok, migrated } = await verifyPin(pin);
    if (ok) {
      await resetPinFails();
      return { ok: true, locked: false, lockedUntil: 0, failsLeft: FAILS_BEFORE_LOCK, migrated };
    }
    const fails = (Number(await read(PIN_KEYS.fails)) || 0) + 1;
    const lockMs = lockMsFor(fails, lockCount);
    if (lockMs > 0) {
      const until = now() + lockMs;
      await deps.storage.set(PIN_KEYS.lockedUntil, String(until));
      await deps.storage.set(PIN_KEYS.fails, '0');
      await deps.storage.set(PIN_KEYS.lockCount, String(lockCount + 1));
      return { ok: false, locked: true, lockedUntil: until, failsLeft: 0, migrated: false };
    }
    await deps.storage.set(PIN_KEYS.fails, String(fails));
    return {
      ok: false,
      locked: false,
      lockedUntil: 0,
      failsLeft: FAILS_BEFORE_LOCK - fails,
      migrated: false,
    };
  }

  return {
    hasPin, setPin, clearPinHash, getPinHash, storePinHash,
    verifyPin, checkPin, getPinStatus, resetPinFails, isPinLocked,
  };
}

/** Barrière de calcul (protection enfant/parent), indépendante du PIN. */
export function verifyPuzzle(answer: string, expected: string): boolean {
  return String(answer).trim() === String(expected).trim();
}
