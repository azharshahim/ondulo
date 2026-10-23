// ─── PIN parental : hachage lent (PBKDF2-like) + verrouillage ───────────────
//  • hachage : 10 000 tours de SHA-256 avec un sel fixe (PBKDF2-like).
//    N'est pas du vrai PBKDF2 (expo-crypto ne l'offre pas) mais reste un
//    hachage lent + sel, bien plus fort qu'un simple SHA-256.
//  • stockage : expo-secure-store (Keychain/Keystore) sur mobile ;
//    sur le web, localStorage (protection indicative).
//  • verrouillage : 30 s après 5 échecs, puis durée croissante
//    (60 s, 120 s, 240 s…) par tentative.
import * as SecureStore from 'expo-secure-store';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

const PIN_SALT = 'ondulo::salt::v1';
const PIN_STORAGE_KEY = 'ondulo_pin_hash';
const PIN_FAIL_KEY = 'ondulo_pin_fails';
const PIN_LOCK_KEY = 'ondulo_pin_locked_until';

/** Hachage lent : 10 000 tours de SHA-256 avec sel. */
async function slowHash(pin: string): Promise<string> {
  let h = `${PIN_SALT}:${pin}`;
  for (let i = 0; i < 10000; i++) {
    h = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${h}:${i}`);
  }
  return h;
}

/** Hache un PIN avec un sel fixe (SHA-256). */
export async function hashPin(pin: string): Promise<string> {
  return slowHash(pin);
}

/** Stocke le hachage du PIN dans le store sécurisé (Keychain/Keystore). */
export async function storePinHash(hashed: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PIN_STORAGE_KEY, hashed);
  } catch {
    // Repli web : localStorage (protection indicative).
    try {
      (globalThis as { localStorage?: Storage }).localStorage?.setItem(PIN_STORAGE_KEY, hashed);
    } catch { /* ignore */ }
  }
}

/** Récupère le hachage du PIN. */
export async function getPinHash(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PIN_STORAGE_KEY);
  } catch {
    try {
      return (globalThis as { localStorage?: Storage }).localStorage?.getItem(PIN_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }
}

/** Vérifie un PIN saisi par rapport au hachage stocké. */
export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await getPinHash();
  if (!stored) return false;
  const hashed = await hashPin(pin);
  return hashed === stored;
}

/** Un code parental existe-t-il ? (sinon : barrière par question de calcul) */
export async function hasPin(): Promise<boolean> {
  return (await getPinHash()) !== null;
}

/** Enregistre un nouveau code parental (4 à 6 chiffres). */
export async function setPin(pin: string): Promise<boolean> {
  if (!/^\d{4,6}$/.test(pin)) return false;
  await storePinHash(await hashPin(pin));
  await resetPinFails();
  return true;
}

export interface PinCheckResult {
  ok: boolean;
  /** Vrai si le verrouillage progressif est actif après cette tentative. */
  locked: boolean;
  /** Instant de fin de verrouillage (ms epoch), 0 si non verrouillé. */
  lockedUntil: number;
  /** Tentatives restantes avant le prochain verrouillage. */
  failsLeft: number;
}

/**
 * Vérifie un PIN en appliquant le verrouillage progressif.
 * Point d'entrée unique pour l'interface (aucun appel direct à verifyPin).
 */
export async function checkPin(pin: string): Promise<PinCheckResult> {
  const { lockedUntil } = await getPinStatus();
  if (Date.now() < lockedUntil) {
    return { ok: false, locked: true, lockedUntil, failsLeft: 0 };
  }
  const ok = await verifyPin(pin);
  if (ok) {
    await resetPinFails();
    return { ok: true, locked: false, lockedUntil: 0, failsLeft: 5 };
  }
  const lockMs = await registerPinFail();
  const after = await getPinStatus();
  return {
    ok: false,
    locked: lockMs > 0,
    lockedUntil: lockMs > 0 ? Date.now() + lockMs : 0,
    failsLeft: lockMs > 0 ? 0 : Math.max(0, 5 - after.fails),
  };
}

/** Efface le hachage du PIN (réinitialisation). */
export async function clearPinHash(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_STORAGE_KEY);
  } catch { /* ignore */ }
  try {
    (globalThis as { localStorage?: Storage }).localStorage?.removeItem(PIN_STORAGE_KEY);
  } catch { /* ignore */ }
}

/** Vérifie la barrière parentale (question de calcul). */
export function verifyPuzzle(question: string, answer: string, expected: string): boolean {
  return String(answer).trim() === String(expected).trim();
}

// ─── Verrouillage progressif ───────────────────────────────────────────────
/** Récupère le nombre d'échecs et l'instant de déblocage (ms). */
export async function getPinStatus(): Promise<{ fails: number; lockedUntil: number }> {
  const fails = Number(
    await getItem(PIN_FAIL_KEY, '0'),
  ) || 0;
  const lockedUntil = Number(
    await getItem(PIN_LOCK_KEY, '0'),
  ) || 0;
  return { fails, lockedUntil };
}

/** Enregistre un échec et calcule le verrouillage (30 s après 5 échecs,
 * puis 60 s, 120 s, 240 s… par tentative). */
export async function registerPinFail(): Promise<number> {
  const fails = (Number(await getItem(PIN_FAIL_KEY, '0')) || 0) + 1;
  let lockMs = 0;
  if (fails >= 5) {
    const step = Math.floor((fails - 5) / 1) + 1;
    lockMs = 30 * 1000 * Math.pow(2, Math.min(step, 5));
  }
  if (fails >= 5) {
    const now = Date.now();
    await setItem(PIN_LOCK_KEY, String(now + lockMs));
    await setItem(PIN_FAIL_KEY, String(0)); // échecs remis à zéro après verrouillage
  } else {
    await setItem(PIN_FAIL_KEY, String(fails));
  }
  return lockMs;
}

/** Réinitialise les échecs (après un PIN correct). */
export async function resetPinFails(): Promise<void> {
  await setItem(PIN_FAIL_KEY, '0');
  await setItem(PIN_LOCK_KEY, '0');
}

/** Vérifie si le PIN est actuellement verrouillé. */
export async function isPinLocked(): Promise<boolean> {
  const { lockedUntil } = await getPinStatus();
  return Date.now() < lockedUntil;
}

async function getItem(key: string, fallback: string): Promise<string> {
  try {
    const v = await SecureStore.getItemAsync(key);
    return v ?? fallback;
  } catch {
    try {
      return (globalThis as { localStorage?: Storage }).localStorage?.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    try {
      (globalThis as { localStorage?: Storage }).localStorage?.setItem(key, value);
    } catch { /* ignore */ }
  }
}
