// ─── Primitives cryptographiques du code parental (sans dépendance Expo) ────
// Ce module est volontairement pur (aucun import natif) pour être testable
// hors application, dans Node comme sur mobile/web.
//
// Schéma v2 par défaut (scrypt, RFC 7914 — memory-hard) :
//   scrypt$<N>$<r>$<p>$<sel base64>$<clé base64>
// Schéma v2 alternatif (PBKDF2-HMAC-SHA256, RFC 8018) :
//   pbkdf2-sha256$<itérations>$<sel base64>$<clé base64>
//
// Les deux utilisent un SEL ALÉATOIRE de 16 octets par code parental.
//
// Ancien schéma (v1, migré automatiquement au premier code correct) :
//   64 caractères hexadécimaux = 10 000 tours de SHA-256 chaînés à la main
//   avec un sel FIXE. Conservé uniquement pour la migration.
import { scrypt } from '@noble/hashes/scrypt.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

// ── Paramètres scrypt (défaut) ─────────────────────────────────────────────
// N = 2^14 (16 384), r = 8, p = 1 → 16 Mo de mémoire, ~1 s en JS.
// Le coût mémoire rend l'attaque par GPU/ASIC bien plus chère qu'un simple
// hachage itéré, à durée d'attente comparable pour le parent.
export const SCRYPT_N = 16_384;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;

// ── Paramètres PBKDF2 (variante disponible) ────────────────────────────────
/** Itérations PBKDF2-SHA256 (plancher recommandé : ≥ 100 000). */
export const PBKDF2_ITERATIONS = 100_000;

/** Longueur du sel aléatoire, en octets. */
export const SALT_BYTES = 16;
/** Longueur de la clé dérivée, en octets. */
export const KEY_BYTES = 32;
/** Sel de l'ancien schéma (v1) — figé, sert uniquement à la migration. */
export const LEGACY_SALT = 'ondulo::salt::v1';
/** Nombre de tours de l'ancien schéma (v1). */
export const LEGACY_ROUNDS = 10_000;

const SCRYPT_SCHEME = 'scrypt';
const PBKDF2_SCHEME = 'pbkdf2-sha256';

/** Source d'aléa par défaut (web / Node). Remplaçable par expo-crypto. */
export function defaultRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error('aucune source d’aléa cryptographique disponible');
  }
  cryptoObj.getRandomValues(out);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function fromBase64(s: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Dérive une clé scrypt (memory-hard). */
export function deriveKeyScrypt(
  pin: string, salt: Uint8Array,
  params: { N: number; r: number; p: number } = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
): Uint8Array {
  return scrypt(new TextEncoder().encode(pin), salt, { ...params, dkLen: KEY_BYTES });
}

/** Dérive une clé PBKDF2-HMAC-SHA256. */
export function deriveKey(pin: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Uint8Array {
  return pbkdf2(sha256, new TextEncoder().encode(pin), salt, { c: iterations, dkLen: KEY_BYTES });
}

/** Hache un PIN : sel aléatoire + scrypt (schéma par défaut). */
export function hashPinNew(pin: string, randomBytes: (n: number) => Uint8Array = defaultRandomBytes): string {
  const salt = randomBytes(SALT_BYTES);
  const key = deriveKeyScrypt(pin, salt);
  return `${SCRYPT_SCHEME}$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${toBase64(salt)}$${toBase64(key)}`;
}

/** Hache un PIN avec PBKDF2-SHA256 (variante). */
export function hashPinPbkdf2(pin: string, randomBytes: (n: number) => Uint8Array = defaultRandomBytes): string {
  const salt = randomBytes(SALT_BYTES);
  const key = deriveKey(pin, salt);
  return `${PBKDF2_SCHEME}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(key)}`;
}

/** Vrai si la chaîne stockée utilise un schéma v2 (scrypt ou PBKDF2). */
export function isModernHash(stored: string): boolean {
  return stored.startsWith(`${SCRYPT_SCHEME}$`) || stored.startsWith(`${PBKDF2_SCHEME}$`);
}

/** Vrai si la chaîne stockée est un hachage de l'ancien schéma (v1). */
export function isLegacyHash(stored: string): boolean {
  return /^[0-9a-f]{64}$/i.test(stored);
}

/** Nombre d'itérations PBKDF2 déclaré (0 si scrypt ou illisible). */
export function iterationsOf(stored: string): number {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== PBKDF2_SCHEME) return 0;
  const n = Number(parts[1]);
  return Number.isFinite(n) ? n : 0;
}

/** Paramètres scrypt déclarés dans un hachage (null si autre schéma). */
export function scryptParamsOf(stored: string): { N: number; r: number; p: number } | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== SCRYPT_SCHEME) return null;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (![N, r, p].every((v) => Number.isFinite(v) && v > 0)) return null;
  return { N, r, p };
}

/** Mémoire utilisée par scrypt : 128 · N · r octets. */
export function scryptMemoryBytes(N: number, r: number): number {
  return 128 * N * r;
}

/** Comparaison à temps constant (évite les attaques temporelles). */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Vérifie un PIN contre un hachage v2 (scrypt ou PBKDF2). */
export function verifyHashNew(pin: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts[0] === SCRYPT_SCHEME && parts.length === 6) {
    const params = scryptParamsOf(stored);
    if (!params) return false;
    const salt = fromBase64(parts[4]);
    const expected = fromBase64(parts[5]);
    if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false;
    return constantTimeEqual(deriveKeyScrypt(pin, salt, params), expected);
  }
  if (parts[0] === PBKDF2_SCHEME && parts.length === 4) {
    const iterations = iterationsOf(stored);
    if (iterations <= 0) return false;
    const salt = fromBase64(parts[2]);
    const expected = fromBase64(parts[3]);
    if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false;
    return constantTimeEqual(deriveKey(pin, salt, iterations), expected);
  }
  return false;
}

/**
 * Ancien hachage (v1) : 10 000 tours de SHA-256 chaînés à la main.
 * `digestHex` est injecté (expo-crypto côté app, node:crypto côté tests).
 */
export async function legacyHash(
  pin: string,
  digestHex: (input: string) => Promise<string>,
): Promise<string> {
  let h = `${LEGACY_SALT}:${pin}`;
  for (let i = 0; i < LEGACY_ROUNDS; i++) {
    h = await digestHex(`${h}:${i}`);
  }
  return h;
}
