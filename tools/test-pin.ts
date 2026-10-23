// ─── Tests du code parental (npm run test:pin) ─────────────────────────────
//  1. PBKDF2-SHA256 conforme à la RFC 8018 : comparaison avec node:crypto ;
//  2. sel aléatoire : deux hachages du même PIN diffèrent, les deux vérifient ;
//  3. mauvais PIN refusé, PIN tronqué refusé, format 4-6 chiffres ;
//  4. migration automatique d'un ancien hachage v1 (10 000 SHA-256, sel fixe)
//     au premier PIN correct, en conservant le même PIN ;
//  5. verrouillage progressif à horloge simulée : 30 s, 60 s, 120 s, 240 s.
import { pbkdf2Sync, scryptSync, createHash } from 'node:crypto';
import {
  PBKDF2_ITERATIONS, SALT_BYTES, KEY_BYTES, SCRYPT_N, SCRYPT_R, SCRYPT_P,
  deriveKey, deriveKeyScrypt, hashPinNew, hashPinPbkdf2, verifyHashNew,
  isModernHash, isLegacyHash, iterationsOf, scryptParamsOf, scryptMemoryBytes,
  toBase64, fromBase64, legacyHash,
} from '../src/state/pinCrypto';
import { createPinService, lockMsFor, FAILS_BEFORE_LOCK, type PinStorage } from '../src/state/pinService';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
}

/** Stockage mémoire (remplace SecureStore dans les tests). */
function memoryStorage(): PinStorage & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    get: async (k) => raw.get(k) ?? null,
    set: async (k, v) => { raw.set(k, v); },
    del: async (k) => { raw.delete(k); },
  };
}

const digestHex = async (input: string) =>
  createHash('sha256').update(input, 'utf8').digest('hex');

async function main(): Promise<void> {
  console.log('── 1. Primitives de dérivation (conformité aux standards) ──');
  const salt = new Uint8Array(16).fill(7);

  // scrypt (schéma par défaut) — vecteur de référence node:crypto SCRYPT.
  const mineScrypt = deriveKeyScrypt('1234', salt);
  const refScrypt = new Uint8Array(scryptSync('1234', salt, KEY_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }));
  check(`scrypt identique à node:crypto (N=2^${Math.log2(SCRYPT_N)}, r=${SCRYPT_R}, p=${SCRYPT_P})`,
    toBase64(mineScrypt) === toBase64(refScrypt));
  check(`mémoire scrypt = ${(scryptMemoryBytes(SCRYPT_N, SCRYPT_R) / 1024 / 1024).toFixed(0)} Mo (≥ 16 Mo)`,
    scryptMemoryBytes(SCRYPT_N, SCRYPT_R) >= 16 * 1024 * 1024);

  // PBKDF2 (variante disponible) — vecteur de référence node:crypto.
  check(`PBKDF2 : itérations ≥ 100 000 (${PBKDF2_ITERATIONS})`, PBKDF2_ITERATIONS >= 100_000);
  const minePbkdf2 = deriveKey('1234', salt, PBKDF2_ITERATIONS);
  const refPbkdf2 = new Uint8Array(pbkdf2Sync('1234', salt, PBKDF2_ITERATIONS, KEY_BYTES, 'sha256'));
  check('PBKDF2-SHA256 identique à node:crypto', toBase64(minePbkdf2) === toBase64(refPbkdf2));
  check(`sel de ${SALT_BYTES} octets, clé de ${KEY_BYTES} octets`, SALT_BYTES === 16 && KEY_BYTES === 32);

  console.log('── 2. Sel aléatoire ──');
  const h1 = hashPinNew('4321');
  const h2 = hashPinNew('4321');
  check('deux hachages du même PIN sont différents (sel aléatoire)', h1 !== h2);
  check('les deux hachages vérifient le bon PIN', verifyHashNew('4321', h1) && verifyHashNew('4321', h2));
  check('un mauvais PIN ne vérifie pas', !verifyHashNew('4322', h1));
  const parts = h1.split('$');
  const sp = scryptParamsOf(h1);
  check(`format v2 « ${parts[0]}$<N>$<r>$<p>$<sel>$<clé> »`,
    parts[0] === 'scrypt' && parts.length === 6 && !!sp && fromBase64(parts[4]).length === 16);
  check('le PIN en clair n’apparaît pas dans le hachage', !h1.includes('4321'));

  // Variante PBKDF2 : format et vérification.
  const hP = hashPinPbkdf2('4321');
  check('variante PBKDF2 : format et itérations déclarées',
    iterationsOf(hP) === PBKDF2_ITERATIONS && verifyHashNew('4321', hP) && !verifyHashNew('4322', hP));

  console.log('── 3. Service : définition et vérification ──');
  {
    const storage = memoryStorage();
    const svc = createPinService({ storage, digestHex });
    check('aucun code au départ', (await svc.hasPin()) === false);
    check('PIN trop court refusé', (await svc.setPin('12')) === false);
    check('PIN non numérique refusé', (await svc.setPin('12ab')) === false);
    check('PIN 4 chiffres accepté', (await svc.setPin('1234')) === true);
    check('seul le hachage est stocké', isModernHash(storage.raw.get('ondulo_pin_hash') ?? ''));
    check('bon PIN accepté', (await svc.checkPin('1234')).ok === true);
    const afterOk = await svc.getPinStatus();
    check('un succès laisse les compteurs à zéro', afterOk.fails === 0 && afterOk.lockedUntil === 0);
    check('mauvais PIN refusé', (await svc.checkPin('9999')).ok === false);
    const afterFail = await svc.getPinStatus();
    check('un échec incrémente le compteur (1)', afterFail.fails === 1);
    check('un succès remet le compteur d’échecs à zéro',
      (await svc.checkPin('1234')).ok && (await svc.getPinStatus()).fails === 0);
  }

  console.log('── 4. Migration automatique de l’ancien hachage v1 ──');
  {
    const storage = memoryStorage();
    const svc = createPinService({ storage, digestHex });
    const oldHash = await legacyHash('2468', digestHex);
    storage.raw.set('ondulo_pin_hash', oldHash);
    check('ancien hachage reconnu comme v1', isLegacyHash(oldHash) && !isModernHash(oldHash));

    const bad = await svc.checkPin('0000');
    check('mauvais PIN sur v1 : refusé et non migré',
      !bad.ok && !bad.migrated && storage.raw.get('ondulo_pin_hash') === oldHash);

    const t0 = Date.now();
    const good = await svc.checkPin('2468');
    const dt = Date.now() - t0;
    const stored = storage.raw.get('ondulo_pin_hash') ?? '';
    check('bon PIN sur v1 : accepté', good.ok);
    check('migration signalée', good.migrated);
    check('hachage remplacé par scrypt (v2, sel aléatoire)', isModernHash(stored) && !!scryptParamsOf(stored));
    check(`l’ancien hachage n’est plus stocké`, stored !== oldHash);
    check('le même PIN continue de fonctionner après migration', (await svc.checkPin('2468')).ok);
    check('et rien n’est remigré ensuite', (await svc.checkPin('2468')).migrated === false);
    console.log(`    · migration mesurée : ${dt} ms (ancien schéma 10 000 tours + scrypt N=2^${Math.log2(SCRYPT_N)})`);
  }

  console.log('── 5. Verrouillage progressif (horloge simulée) ──');
  {
    let clock = 1_700_000_000_000;
    const storage = memoryStorage();
    const svc = createPinService({ storage, now: () => clock, digestHex });
    await svc.setPin('1111');

    const lockDurations: number[] = [];
    for (let round = 1; round <= 4; round++) {
      // 5 échecs consécutifs → verrouillage.
      for (let i = 0; i < FAILS_BEFORE_LOCK; i++) {
        const r = await svc.checkPin('0000');
        if (i < FAILS_BEFORE_LOCK - 1) {
          check(`tour ${round}, échec ${i + 1} : pas encore verrouillé (${r.failsLeft} essai(s) restant(s))`,
            !r.locked && r.failsLeft === FAILS_BEFORE_LOCK - (i + 1));
        } else {
          lockDurations.push(r.lockedUntil - clock);
          check(`tour ${round} : verrouillé après ${FAILS_BEFORE_LOCK} échecs (${(r.lockedUntil - clock) / 1000} s)`, r.locked);
        }
      }
      // Pendant le verrouillage, même le BON code est refusé.
      const during = await svc.checkPin('1111');
      check(`tour ${round} : le bon code est refusé pendant le verrouillage`, !during.ok && during.locked);
      // On avance l'horloge juste au-delà du verrouillage (sans succès entre
      // deux tours : l'escalade doit se poursuivre).
      clock += lockDurations[round - 1] + 1000;
      if (round === 4) {
        const after = await svc.checkPin('1111');
        check('après 4 verrouillages, le bon code est de nouveau accepté', after.ok);
        check('et l’escalade est remise à zéro par ce succès',
          (await svc.getPinStatus()).lockCount === 0);
      }
    }
    check('durées doublent : 30 s → 60 s → 120 s → 240 s',
      JSON.stringify(lockDurations) === JSON.stringify([30_000, 60_000, 120_000, 240_000]),
      JSON.stringify(lockDurations));
    check('lockMsFor est plafonné à 8 minutes', lockMsFor(5, 20) === 480_000);
    check('lockMsFor = 0 sous le seuil', lockMsFor(4, 0) === 0);
  }

  console.log(failed
    ? `\n❌ ${failed} vérification(s) en échec, ${passed} réussie(s).`
    : `\n✅ Code parental : ${passed} vérifications réussies (scrypt N=2^${Math.log2(SCRYPT_N)} r=${SCRYPT_R} p=${SCRYPT_P}, sel aléatoire, migration v1, verrouillage progressif).`);
  process.exit(failed ? 1 : 0);
}

void main().catch((e) => {
  console.error('ERREUR', e);
  process.exit(1);
});
