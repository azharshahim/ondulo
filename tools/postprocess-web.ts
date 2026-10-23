// ─── Post-traitement du HTML web exporté ───────────────────────────────────
// Le gabarit de @expo/cli ne contient pas de balise `description` (seul le
// <title> est injecté, et seulement à l'exécution par App.tsx). On l'écrit
// donc dans dist/index.html après l'export, de façon déterministe :
//   • <title>Ondulo</title> ;
//   • <meta name="description"> + Open Graph (og:title / og:description) ;
//   • <html lang="fr"> cohérent avec la langue par défaut.
// Idempotent : relancer le script ne duplique aucune balise.
// Usage : tsx tools/postprocess-web.ts [dossier]   (défaut : dist)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SITE_TITLE = 'Ondulo';
const SITE_DESCRIPTION =
  'Ondulo : jeu de réflexion familial sans minuteur. Glisse les serpents dans leurs trous !';

const dir = process.argv[2] ?? 'dist';
const file = join(dir, 'index.html');

if (!existsSync(file)) {
  console.error(`✗ ${file} introuvable : lancer « npx expo export --platform web » d'abord.`);
  process.exit(1);
}

let html = readFileSync(file, 'utf8');

/** Remplace une balise auto-fermante existante, sinon l'insère après <title>. */
function upsertMeta(pattern: RegExp, tag: string, anchor: string): void {
  if (pattern.test(html)) {
    html = html.replace(pattern, tag);
  } else {
    html = html.replace(anchor, `${anchor}\n    ${tag}`);
  }
}

// 1. Titre.
if (/<title>.*<\/title>/i.test(html)) {
  html = html.replace(/<title>.*<\/title>/i, `<title>${SITE_TITLE}</title>`);
} else {
  html = html.replace('</head>', `  <title>${SITE_TITLE}</title>\n</head>`);
}

// 2. Meta description et Open Graph.
const anchor = `<title>${SITE_TITLE}</title>`;
upsertMeta(/<meta\s+name=["']description["'][^>]*>/i,
  `<meta name="description" content="${SITE_DESCRIPTION}" />`, anchor);
upsertMeta(/<meta\s+property=["']og:title["'][^>]*>/i,
  `<meta property="og:title" content="${SITE_TITLE}" />`, anchor);
upsertMeta(/<meta\s+property=["']og:description["'][^>]*>/i,
  `<meta property="og:description" content="${SITE_DESCRIPTION}" />`, anchor);

// 3. Langue du document (langue par défaut de l'application).
html = html.replace(/<html([^>]*)lang=["'][^"']*["']/i, '<html$1lang="fr"');

writeFileSync(file, html, 'utf8');
console.log(`✓ ${file} : titre « ${SITE_TITLE} », meta description et Open Graph écrits, lang="fr"`);
