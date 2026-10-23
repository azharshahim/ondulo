// ─── PIN parental : couche native (Expo) ───────────────────────────────────
//  • hachage : PBKDF2-SHA256, 210 000 itérations, sel aléatoire de 16 octets
//    (@noble/hashes). L'ancien schéma (10 000 tours de SHA-256 avec un sel
//    fixe) est reconnu et MIGRÉ automatiquement au premier code correct —
//    voir src/state/pinCrypto.ts et src/state/pinService.ts.
//  • stockage : expo-secure-store (Keychain/Keystore) sur mobile ;
//    sur le web, localStorage (protection indicative).
//  • verrouillage progressif : 30 s, 60 s, 120 s, 240 s, 480 s (plafond)
//    après 5 échecs consécutifs.
import * as SecureStore from 'expo-secure-store';
import { digestStringAsync, CryptoDigestAlgorithm, getRandomBytes } from 'expo-crypto';
import { createPinService, verifyPuzzle as verifyPuzzlePure } from './pinService';
import { hashPinNew } from './pinCrypto';

function webStorage(): Storage | undefined {
  return (globalThis as { localStorage?: Storage }).localStorage;
}

const storage = {
  get: async (key: string): Promise<string | null> => {
    try {
      const v = await SecureStore.getItemAsync(key);
      if (v !== null) return v;
    } catch { /* repli web */ }
    try {
      return webStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch { /* repli web */ }
    try {
      webStorage()?.setItem(key, value);
    } catch { /* ignore */ }
  },
  del: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch { /* ignore */ }
    try {
      webStorage()?.removeItem(key);
    } catch { /* ignore */ }
  },
};

const service = createPinService({
  storage,
  now: () => Date.now(),
  randomBytes: (n: number) => getRandomBytes(n),
  // Utilisé uniquement pour reconnaître puis migrer un ancien hachage v1.
  digestHex: (input: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, input),
});

/** Hache un PIN (PBKDF2-SHA256 + sel aléatoire). */
export async function hashPin(pin: string): Promise<string> {
  return hashPinNew(pin, (n: number) => getRandomBytes(n));
}

export const storePinHash = service.storePinHash;
export const getPinHash = service.getPinHash;
export const hasPin = service.hasPin;
export const setPin = service.setPin;
export const clearPinHash = service.clearPinHash;
export const getPinStatus = service.getPinStatus;
export const resetPinFails = service.resetPinFails;
export const isPinLocked = service.isPinLocked;
export const checkPin = service.checkPin;

/** Vérifie un PIN (sans verrouillage ; l'interface utilise checkPin). */
export async function verifyPin(pin: string): Promise<boolean> {
  const res = await service.verifyPin(pin);
  return res.ok;
}

/** Barrière parentale (question de calcul). */
export function verifyPuzzle(answer: string, expected: string): boolean {
  return verifyPuzzlePure(answer, expected);
}
