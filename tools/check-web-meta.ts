// ─── Vérifie le <head> du HTML EXPORTÉ (npm run test:web) ───────────────────
// Contrôle le fichier réellement déployé (dist/index.html), pas l'état
// obtenu après exécution du JavaScript : titre, meta description, langue,
// et cohérence du préfixe (baseUrl) pour les scripts, le favicon et l'icône.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const EXPECTED_TITLE = 'Ondulo';
const EXPECTED_DESCRIPTION = 'Ondulo : jeu de réflexion familial sans minuteur. Glisse les serpents dans leurs trous !';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
}

const file = join(DIST, 'index.html');
if (!existsSync(file)) {
  console.error(`✗ ${file} absent : lancer d'abord « npx expo export --platform web ».`);
  process.exit(1);
}
const html = readFileSync(file, 'utf8');
const appJson = JSON.parse(readFileSync('app.json', 'utf8')) as {
  expo: { name: string; web?: { favicon?: string }; experiments?: { baseUrl?: string } };
};
const baseUrl = (appJson.expo.experiments?.baseUrl ?? '').replace(/\/$/, '');

console.log(`── ${file} (baseUrl = ${baseUrl || '(aucun)'}) ──`);

const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
check(`<title> = « ${EXPECTED_TITLE} »`, title === EXPECTED_TITLE, `trouvé « ${title ?? ''} »`);

const desc = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0];
const descContent = desc?.match(/content=["']([^"']*)["']/i)?.[1]?.trim();
check('meta description présente dans le HTML exporté', !!descContent, 'absente');
check('contenu de la meta description exact', descContent === EXPECTED_DESCRIPTION, `« ${descContent ?? ''} »`);
check('meta description ≥ 50 caractères', (descContent ?? '').length >= 50, `${(descContent ?? '').length} caractères`);

check('langue du document déclarée', /<html[^>]+lang=["'][a-z-]+["']/i.test(html),
  html.match(/<html[^>]*>/i)?.[0]);

const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
check('au moins un script référencé', scripts.length > 0);
const badScripts = scripts.filter((s) => !s.startsWith(`${baseUrl}/`));
check(`tous les scripts sont préfixés par « ${baseUrl}/ »`, badScripts.length === 0, badScripts.join(', '));

const icons = [...html.matchAll(/<link[^>]+rel=["'](?:icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]);
const badIcons = icons.filter((i) => baseUrl && !i.startsWith(`${baseUrl}/`) && !i.startsWith('data:'));
check('icônes préfixées par baseUrl', badIcons.length === 0, badIcons.join(', '));

check('aucune référence à l’ancien nom du dépôt dans le HTML', !html.includes('serpent-puzzle'),
  (html.match(/serpent-puzzle/g) ?? []).length + ' occurrence(s)');

console.log(failed
  ? `\n❌ ${failed} vérification(s) en échec, ${passed} réussie(s).`
  : `\n✅ HTML exporté conforme : titre « ${EXPECTED_TITLE} », meta description présente, préfixe ${baseUrl}/ appliqué.`);
process.exit(failed ? 1 : 0);
