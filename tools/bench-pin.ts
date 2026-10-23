// ─── Mesure du coût des fonctions de dérivation du code parental ───────────
// Sert à choisir les paramètres sans dégrader l'expérience (attente du parent).
// Lancer avec : npx tsx tools/bench-pin.ts
import { scrypt } from '@noble/hashes/scrypt.js';
import { deriveKey, SCRYPT_N, SCRYPT_R, SCRYPT_P, scryptMemoryBytes } from '../src/state/pinCrypto';

const password = new TextEncoder().encode('123456');
const salt = new Uint8Array(16).fill(1);

const t0 = performance.now();
scrypt(password, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, dkLen: 32 });
console.log(`scrypt N=2^${Math.log2(SCRYPT_N)} r=${SCRYPT_R} p=${SCRYPT_P} : ` +
  `${(performance.now() - t0).toFixed(0)} ms, ${(scryptMemoryBytes(SCRYPT_N, SCRYPT_R) / 1024 / 1024).toFixed(0)} Mo`);

for (const iterations of [100_000, 210_000, 600_000]) {
  const t = performance.now();
  deriveKey('123456', salt, iterations);
  console.log(`pbkdf2-sha256 ${iterations} itérations : ${(performance.now() - t).toFixed(0)} ms`);
}
