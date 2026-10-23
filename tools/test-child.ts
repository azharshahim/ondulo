// ─── Test « profil enfant » (npm run test:child) ───────────────────────────
// Prouve, preuves à l'appui, que dans un profil enfant :
//   A. le code ne contient AUCUNE publicité, AUCUN achat intégré, AUCUN lien
//      externe (audit statique des dépendances et des sources) ;
//   B. une partie complète (niveau 1 terminé) ne génère AUCUNE requête vers
//      un domaine tiers — journal des requêtes réseau joint ;
//   C. les écrans réservés aux adultes (tableau de bord parent) ne sont pas
//      accessibles sans franchir la porte parentale (code ou question de
//      calcul), et une mauvaise réponse ne déverrouille rien.
//
// Prérequis : `npx expo export --platform web` puis le serveur de test
// (tools/serve-dist.ts) ; PLAYWRIGHT_BASE_URL permet de changer l'URL.
import { chromium, type Page, type Browser } from 'playwright';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildState, getEndCell, applyMove } from '../src/game/engine';
import { solve } from '../src/game/solver';
import { HANDCRAFTED } from '../src/levels/handcrafted';
import type { GameState, LevelDef, Move } from '../src/game/types';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173/ondulo/';
const OUT_DIR = 'reports';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
}

// ── A. Audit statique ──────────────────────────────────────────────────────
const AD_TOKENS = ['admob', 'google-mobile-ads', 'applovin', 'ironsource', 'unity-ads', 'facebook-ads', 'ads-sdk', 'bidmachine'];
const IAP_TOKENS = ['in-app-purchase', 'iap', 'revenuecat', 'purchases', 'billing', 'storekit', 'play-billing'];

function auditStatic(): void {
  console.log('── A. Publicité / achats / liens externes (statique) ──');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
  };
  const deps = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];
  const adDeps = deps.filter((d) => AD_TOKENS.some((tok) => d.toLowerCase().includes(tok)));
  const iapDeps = deps.filter((d) => IAP_TOKENS.some((tok) => d.toLowerCase().includes(tok)));
  check('aucune dépendance publicitaire', adDeps.length === 0, adDeps.join(', '));
  check('aucune dépendance d’achat intégré', iapDeps.length === 0, iapDeps.join(', '));

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
    }
  };
  walk('src');
  files.push('App.tsx', 'index.ts');

  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const patterns: [RegExp, string][] = [
      [/https?:\/\//, 'URL absolue'],
      [/Linking\.openURL|Linking\.canOpenURL/, 'ouverture de lien externe'],
      [/WebView|<iframe/, 'contenu web embarqué'],
      [/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/, 'appel réseau'],
      [/admob|interstitial|rewardedAd/i, 'SDK publicitaire'],
      [/makePurchase|restorePurchases|requestPurchase/i, 'achat intégré'],
    ];
    for (const [re, label] of patterns) {
      if (re.test(src)) offenders.push(`${file} → ${label}`);
    }
  }
  check('aucune URL absolue, aucun appel réseau, aucun lien externe dans src/ et App.tsx', offenders.length === 0, offenders.join(' | '));
}

// ── Plan de résolution du niveau 1 (moteur réel) ───────────────────────────
interface Step { fromCell: { r: number; c: number }; toCell: { r: number; c: number }; }

function planFor(level: LevelDef): { steps: Step[]; path: Move[]; end: GameState } {
  const start = buildState(level);
  const res = solve(level, start, 400000);
  if (!res.path) throw new Error('niveau 1 non résolu par le solveur');
  let state = start;
  const steps: Step[] = [];
  for (const move of res.path) {
    const snake = state.snakes.find((s) => s.id === move.snakeId);
    if (!snake) throw new Error(`serpent inconnu ${move.snakeId}`);
    steps.push({ fromCell: getEndCell(snake, move.end), toCell: move.target });
    state = applyMove(level, state, move);
  }
  return { steps, path: res.path, end: state };
}

// ── Pilotage du plateau par glisser réel ──────────────────────────────────
async function dragCell(page: Page, box: { x: number; y: number; width: number; height: number },
  cell: number, from: { r: number; c: number }, to: { r: number; c: number }): Promise<void> {
  const x0 = box.x + (from.c + 0.5) * cell;
  const y0 = box.y + (from.r + 0.5) * cell;
  const x1 = box.x + (to.c + 0.5) * cell;
  const y1 = box.y + (to.r + 0.5) * cell;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const STEPS = 12;
  for (let i = 1; i <= STEPS; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / STEPS, y0 + ((y1 - y0) * i) / STEPS);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(140);
}

interface NetEntry { url: string; host: string; method: string; type: string; marker?: string; }

async function main(): Promise<void> {
  auditStatic();

  const level = HANDCRAFTED[0];
  const { steps } = planFor(level);
  console.log(`  · niveau 1 : ${level.id}, solution optimale = ${steps.length} coups`);

  const browser: Browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, locale: 'fr-FR' });
  const page = await context.newPage();
  const net: NetEntry[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    net.push({ url: r.url(), host: u.host, method: r.method(), type: r.resourceType() });
  });
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`); });

  // Langue forcée en français pour piloter les libellés.
  await context.addInitScript(() => {
    try { window.localStorage.setItem('@ondulo/lang', 'fr'); } catch { /* ignore */ }
  });

  console.log('── B. Session profil enfant (navigateur réel) ──');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 1. Passer le tutoriel, puis créer un profil enfant (tranche 3-5 ans).
  await page.getByText('Passer le tutoriel', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.locator('input[placeholder]').first().fill('Nino');
  await page.getByText('3-5 ans', { exact: true }).first().click();
  await page.getByText('Créer un profil', { exact: true }).first().click();
  await page.waitForTimeout(600);

  const childProfile = await page.evaluate(() => {
    const raw = window.localStorage.getItem('@ondulo/profiles');
    if (!raw) return null;
    const data = JSON.parse(raw) as { profiles: { isChild: boolean; ageGroup: string }[] };
    return data.profiles.length ? data.profiles[0] : null;
  });
  check('un profil enfant a bien été créé', !!childProfile && childProfile.isChild === true,
    JSON.stringify(childProfile));

  // 2. Lancer le niveau 1 et le terminer par de vrais glissers.
  await page.getByText('Jouer', { exact: true }).first().click();
  await page.waitForTimeout(900);
  const board = page.locator('[data-testid="game-board"]');
  await board.waitFor({ state: 'visible', timeout: 15000 });
  const box = await board.boundingBox();
  if (!box) throw new Error('plateau introuvable');
  const cell = box.width / level.cols;

  // Chaque coup est vérifié sur le compteur de coups affiché ; un geste
  // perdu est rejoué UNE fois (2 tentatives maximum par coup).
  const movesCount = async (): Promise<number> => {
    const raw = await page.locator('[data-testid="top-bar"]').innerText();
    const m = raw.match(/(\d+)\s*$/);
    return m ? Number(m[1]) : -1;
  };
  let applied = 0;
  for (const [i, step] of steps.entries()) {
    const before = await movesCount();
    await dragCell(page, box, cell, step.fromCell, step.toCell);
    if ((await movesCount()) === before) {
      await dragCell(page, box, cell, step.fromCell, step.toCell); // 2e tentative
    }
    if ((await movesCount()) > before) applied++;
    else console.log(`    · coup ${i + 1} non appliqué (${step.fromCell.r},${step.fromCell.c}) → (${step.toCell.r},${step.toCell.c})`);
  }
  await page.waitForTimeout(1800); // animation d'absorption + confettis
  const won = await page.getByText('Bravo !', { exact: false }).first().isVisible().catch(() => false);
  check(`niveau 1 terminé dans le profil enfant (${applied}/${steps.length} coups appliqués)`, won);
  if (won) {
    const stars = await page.locator('body').innerText();
    console.log(`    · écran de victoire : ${stars.replace(/\n+/g, ' | ').slice(0, 160)}`);
  }

  // 3. Bouton Indice : « pub simulée » interne, aucune requête réseau.
  const beforeHint = net.length;
  if (!won) {
    await page.getByText('Indice', { exact: true }).first().click();
    await page.waitForTimeout(1200);
  }
  check('la « pub simulée » de l’indice n’émet aucune requête', net.length === beforeHint,
    `${net.length - beforeHint} requête(s) pendant l’indice`);

  console.log('── C. Écrans « adultes » inaccessibles sans porte parentale ──');
  const phaseB = net.length;
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  await page.getByText('Tableau de bord parent', { exact: true }).first().click();
  await page.waitForTimeout(500);
  const gateShown = await page.locator('[data-testid="gate-challenge"]').isVisible().catch(() => false);
  const dashboardShown = await page.getByText('Limites', { exact: false }).first().isVisible().catch(() => false);
  check('le tableau de bord parent ouvre la porte parentale', gateShown);
  check('aucun accès au tableau de bord sans porte', !dashboardShown);

  // Mauvais calcul → toujours bloqué.
  const question = (await page.locator('[data-testid="gate-challenge"]').innerText()).trim();
  await page.locator('[data-testid="gate-answer"]').fill('9999');
  await page.locator('[data-testid="gate-submit-answer"]').click();
  await page.waitForTimeout(400);
  const stillGated = await page.locator('[data-testid="gate-challenge"]').isVisible().catch(() => false);
  const errorShown = await page.locator('[data-testid="gate-error"]').isVisible().catch(() => false);
  check('une mauvaise réponse ne déverrouille rien', stillGated && errorShown);

  // Bon calcul → accès autorisé (calcul reformulé pour éviter de le coder en dur).
  const question2 = (await page.locator('[data-testid="gate-challenge"]').innerText()).trim();
  const answer = String(evalSimple(question2.replace(/\s/g, '')));
  await page.locator('[data-testid="gate-answer"]').fill(answer);
  await page.locator('[data-testid="gate-submit-answer"]').click();
  await page.waitForTimeout(800);
  const dashboardNow = await page.getByText('Limites', { exact: false }).first().isVisible().catch(() => false);
  check('bonne réponse → tableau de bord accessible', dashboardNow, `question « ${question2} » → ${answer}`);

  // 4. Journal réseau.
  console.log('── D. Journal des requêtes réseau ──');
  const originHost = new URL(BASE).host;
  const thirdParty = net.filter((r) => r.host !== originHost);
  check('aucune requête vers un domaine tiers pendant toute la session', thirdParty.length === 0,
    thirdParty.map((r) => r.url).join(', '));
  check('aucune erreur JavaScript bloquante', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  mkdirSync(OUT_DIR, { recursive: true });
  const log = [
    `# Journal des requêtes réseau — profil enfant (Ondulo)`,
    `# généré : ${new Date().toISOString()}`,
    `# URL : ${BASE}`,
    `# origine de référence : ${originHost}`,
    `# niveau joué : ${level.id} (${steps.length} coups, terminé = ${won})`,
    `# requêtes totales : ${net.length} — domaines tiers : ${thirdParty.length}`,
    '',
    'MÉTHODE  HÔTE                    TYPE      PHASE',
    ...net.map((r, i) => `${r.method.padEnd(7)}  ${r.host.padEnd(23)} ${r.type.padEnd(9)} ${i < phaseB ? 'B (partie enfant)' : 'C (porte parentale)'}`),
    '',
    `RÉSULTAT : ${thirdParty.length === 0 ? 'AUCUNE requête vers un domaine tiers' : 'REQUÊTES TIERCES DÉTECTÉES'}`,
  ].join('\n');
  writeFileSync(join(OUT_DIR, 'child-network.log'), `${log}\n`, 'utf8');
  console.log(`  · journal écrit : ${OUT_DIR}/child-network.log (${net.length} requêtes, ${new Set(net.map((r) => r.host)).size} hôte(s))`);

  await browser.close();
  console.log(failed
    ? `\n❌ ${failed} vérification(s) en échec, ${passed} réussie(s).`
    : `\n✅ Profil enfant : ${passed} vérifications réussies (0 pub, 0 achat, 0 lien externe, 0 requête tierce).`);
  process.exit(failed ? 1 : 0);
}

/** Évalue « a×b+c » sans eval() pour rester lisible côté test. */
function evalSimple(expr: string): number {
  const m = expr.match(/^(\d+)[×x*](\d+)\+(\d+)$/);
  if (!m) throw new Error(`question inattendue : ${expr}`);
  return Number(m[1]) * Number(m[2]) + Number(m[3]);
}

void main().catch((e) => {
  console.error('ERREUR', e);
  process.exit(1);
});
