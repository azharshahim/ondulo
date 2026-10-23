// ─── Complétude des traductions (npm run test:i18n) ────────────────────────
//  1. chaque locale expose exactement les mêmes clés que le français ;
//  2. aucune valeur n'est restée en français (hors termes identiques par
//     nature : nom de l'app, « OK », « Pause », « Avatar », « Palette »…) ;
//  3. les libellés vides sont refusés.
import { readFileSync, readdirSync } from 'node:fs';

// Liste des langues lue sur le disque : importer src/i18n tirerait expo dans
// un processus Node pur (__DEV__ non défini).
const LANG_IDS = readdirSync('src/i18n/locales')
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

/** Valeurs légitimement identiques d'une langue à l'autre. */
const ALLOWED_SAME_AS_FR = new Set(['appName', 'ok', 'pause', 'avatar', 'palette', 'minutes', 'pin']);
/** Mots réellement identiques en français et dans la langue visée. */
const SAME_WORD: Record<string, Set<string>> = {
  en: new Set(['notifications', 'parent']),
  'pt-BR': new Set(['limits']),
};

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
}

const read = (lang: string): Record<string, string> =>
  JSON.parse(readFileSync(`src/i18n/locales/${lang}.json`, 'utf8')) as Record<string, string>;

const reference = read('fr');
const referenceKeys = Object.keys(reference).sort();

console.log(`── ${LANG_IDS.length} langues, référence française : ${referenceKeys.length} clés ──`);

for (const lang of LANG_IDS) {
  const dict = read(lang);
  const keys = Object.keys(dict).sort();
  const missing = referenceKeys.filter((k) => !(k in dict));
  const extra = keys.filter((k) => !(k in reference));
  const empty = keys.filter((k) => !String(dict[k] ?? '').trim());

  check(`${lang} : ${keys.length} clés, aucune manquante`, missing.length === 0, missing.join(', '));
  check(`${lang} : aucune clé superflue`, extra.length === 0, extra.slice(0, 8).join(', '));
  check(`${lang} : aucun libellé vide`, empty.length === 0, empty.join(', '));

  if (lang !== 'fr') {
    const sameWord = SAME_WORD[lang] ?? new Set<string>();
    const untranslated = keys.filter(
      (k) => !ALLOWED_SAME_AS_FR.has(k) && !sameWord.has(k) && dict[k] === reference[k],
    );
    check(`${lang} : aucune valeur restée en français`, untranslated.length === 0,
      `${untranslated.length} : ${untranslated.slice(0, 6).join(', ')}`);
  }
}

console.log(failed
  ? `\n❌ ${failed} vérification(s) en échec, ${passed} réussie(s).`
  : `\n✅ Traductions complètes : ${LANG_IDS.length} langues × ${referenceKeys.length} clés, aucune valeur en français.`);
process.exit(failed ? 1 : 0);
