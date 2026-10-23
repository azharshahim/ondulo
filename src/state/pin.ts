// ─── PIN parental : hachage et vérification ────────────────────────────────
// Le PIN n'est JAMAIS stocké en clair : on calcule un hachage SHA-256
// + sel (salted hash) et on le stocke via expo-secure-store (iOS Keychain /
// Android Keystore). Sur le web, la protection est indicative : le hachage
// est calculé en JS (crypto.subtle) et stocké en localStorage.
import * as SecureStore from 'expo-secure-store';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

const PIN_SALT = 'ondulo::salt::v1';
const PIN_STORAGE_KEY = 'ondulo_pin_hash';

/** Hache un PIN avec un sel fixe (SHA-256). */
export async function hashPin(pin: string): Promise<string> {
  const h = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${PIN_SALT}:${pin}`);
  return h;
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
