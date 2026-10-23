// ─── Test de stabilité de mise en page (npm run test:stability) ─────────────
// Dans un vrai navigateur, sur le build web exporté :
//   • CLS (Cumulative Layout Shift) = 0 ;
//   • le plateau ne bouge PAS d'un seul pixel quand les textes d'aide, les
//     messages et la modale d'indice apparaissent puis disparaissent ;
//   • la page ne défile jamais (scrollY = 0) et sa hauteur reste celle de la
//     fenêtre (100dvh), y compris après un redimensionnement.
// L'URL est celle du serveur de test (tools/serve-dist.ts), par défaut
// http://localhost:4174/ondulo/.
import { chromium, type Page } from 'playwright';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4174/ondulo/';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
}

interface Box { x: number; y: number; w: number; h: number; }

async function boardBox(page: Page): Promise<Box | null> {
  const b = await page.locator('[data-testid="game-board"]').boundingBox();
  return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
}

function delta(a: Box | null, b: Box | null): number {
  if (!a || !b) return Infinity;
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, locale: 'fr-FR' });
  // Observateur de décalages installé AVANT le chargement de la page.
  await context.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* navigateur sans layout-shift */ }
    try {
      window.localStorage.setItem('@ondulo/lang', 'fr');
      window.localStorage.setItem('@ondulo/profiles', JSON.stringify({
        profiles: [{
          id: 'p1', name: 'Nino', avatarColor: '#EF6B73', ageGroup: '6-9', stars: {}, unlocked: 1,
          daily: {}, skins: [], playTimeMin: 0, levelsDone: 0, lastPlayed: Date.now(), isChild: true,
        }], activeId: 'p1',
      }));
    } catch { /* ignore */ }
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  console.log(`── ${BASE} ──`);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Entrée en jeu.
  await page.getByText('Jouer', { exact: true }).first().click();
  const board = page.locator('[data-testid="game-board"]');
  await board.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1200);

  const box0 = await boardBox(page);
  check('plateau affiché', !!box0);

  // 1. Apparition du message d'aide (au chargement) puis disparition après le
  //    premier coup : le plateau ne doit pas bouger.
  const box = box0!;
  const cell = box.w / 5;
  const cx = box.x + 1.5 * cell;
  const cy = box.y + 2.5 * cell;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(cx, cy - (i * cell) / 10);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const box1 = await boardBox(page);
  check('le plateau ne bouge pas d’un pixel après un coup (textes qui changent)',
    delta(box0, box1) === 0, `décalage ${delta(box0, box1)} px`);

  // 2. Modale d'indice (« pub simulée ») : ouverture puis fermeture.
  await page.getByText('Indice', { exact: true }).first().click();
  await page.waitForTimeout(700);
  const box2 = await boardBox(page);
  check('le plateau ne bouge pas quand la modale d’indice s’ouvre', delta(box0, box2) === 0,
    `décalage ${delta(box0, box2)} px`);
  await page.waitForTimeout(3400);
  const box3 = await boardBox(page);
  check('le plateau ne bouge pas quand l’indice s’affiche', delta(box0, box3) === 0,
    `décalage ${delta(box0, box3)} px`);

  // 3. Aucun défilement de page, hauteur verrouillée.
  const scroll = await page.evaluate(() => ({
    y: window.scrollY,
    bodyH: document.body.getBoundingClientRect().height,
    innerH: window.innerHeight,
    overflow: getComputedStyle(document.body).overflow,
  }));
  check('aucun défilement (scrollY = 0)', scroll.y === 0, `scrollY = ${scroll.y}`);
  check('hauteur de page = hauteur de fenêtre', Math.abs(scroll.bodyH - scroll.innerH) <= 1,
    `${scroll.bodyH} vs ${scroll.innerH}`);
  check('défilement désactivé sur body', scroll.overflow === 'hidden', scroll.overflow);

  // 4. CLS.
  const cls = await page.evaluate(() => (window as unknown as { __cls?: number }).__cls ?? -1);
  check('Cumulative Layout Shift = 0', cls === 0, `CLS = ${cls}`);
  check('aucune erreur JavaScript', errors.length === 0, errors.slice(0, 2).join(' | '));

  // 5. Redimensionnement : le plateau se recentre sans décalage résiduel.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const boxA = await boardBox(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const boxB = await boardBox(page);
  check('après redimensionnement, le plateau est stable', delta(boxA, boxB) === 0,
    `décalage ${delta(boxA, boxB)} px`);

  await browser.close();
  console.log(failed
    ? `\n❌ ${failed} vérification(s) en échec, ${passed} réussie(s).`
    : `\n✅ Stabilité : ${passed} vérifications réussies (CLS 0, plateau immobile au pixel).`);
  process.exit(failed ? 1 : 0);
}

void main().catch((e) => {
  console.error('ERREUR', e);
  process.exit(1);
});
