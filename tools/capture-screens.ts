// ─── Captures d'écran des écrans clés (npm run capture) ────────────────────
// Génère 6 PNG dans reports/captures/ à partir du build web exporté servi
// sous /ondulo/ (tools/serve-dist.ts). Les états sont préparés par
// localStorage, sans toucher au code de l'application :
//   1. accueil en arabe (RTL), 2. accueil en allemand, 3. jeu en mode nuit,
//   4. tableau de bord parent (après la porte parentale),
//   5. « Les serpents dorment », 6. tutoriel du premier lancement.
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4174/ondulo/';
const OUT = 'reports/captures';
mkdirSync(OUT, { recursive: true });

const PROFILE = {
  id: 'p1', name: 'Nino', avatarColor: '#EF6B73', ageGroup: '6-9',
  stars: { '1': 3, '2': 2 }, unlocked: 4, daily: {}, skins: [], playTimeMin: 34,
  levelsDone: 3, lastPlayed: 0, isChild: true,
};

/**
 * Prépare un contexte avec un état donné.
 * `init.firstLaunch` = tutoriel (aucun profil enregistré).
 */
async function makeContext(
  browser: Browser,
  opts: { lang: string; settings?: Record<string, unknown>; parental?: Record<string, unknown>; firstLaunch?: boolean },
): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 414, height: 896 }, locale: 'fr-FR' });
  await context.addInitScript((o) => {
    try {
      window.localStorage.setItem('@ondulo/lang', o.lang);
      if (o.settings) window.localStorage.setItem('@serpent-puzzle/settings', JSON.stringify(o.settings));
      if (o.parental) window.localStorage.setItem('@ondulo/parental', JSON.stringify(o.parental));
      if (!o.firstLaunch) {
        window.localStorage.setItem('@ondulo/profiles', JSON.stringify({ profiles: [o.profile], activeId: o.profile.id }));
      }
    } catch { /* ignore */ }
  }, { ...opts, profile: PROFILE });
  return context;
}

async function shot(context: BrowserContext, name: string, steps: (page: import('playwright').Page) => Promise<void>) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await steps(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✓ ${OUT}/${name}.png`);
  await context.close();
}

async function main(): Promise<void> {
  const browser = await chromium.launch();

  // 1. Accueil en arabe (interface en miroir, RTL).
  await shot(await makeContext(browser, { lang: 'ar' }), '1-accueil-arabe', async () => undefined);

  // 2. Accueil en allemand.
  await shot(await makeContext(browser, { lang: 'de' }), '2-accueil-allemand', async () => undefined);

  // 3. Jeu en mode nuit (apparence et palette « nuit »).
  await shot(
    await makeContext(browser, { lang: 'fr', settings: { appearance: 'nuit', palette: 'nuit' } }),
    '3-jeu-nuit',
    async (page) => {
      await page.getByText('Jouer', { exact: true }).first().click();
      await page.locator('[data-testid="game-board"]').waitFor({ state: 'visible', timeout: 15000 });
      const board = await page.locator('[data-testid="game-board"]').boundingBox();
      if (!board) throw new Error('plateau introuvable');
      // Un coup, pour montrer un serpent engagé sur le plateau.
      const cell = board.width / 5;
      const x = board.x + 1.5 * cell;
      const y = board.y + 2.5 * cell;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(x, y - (i * cell) / 10);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      await page.waitForTimeout(400);
    },
  );

  // 4. Tableau de bord parent, derrière la porte parentale.
  await shot(
    await makeContext(browser, { lang: 'fr', settings: { appearance: 'jour', palette: 'jour' } }),
    '4-tableau-de-bord-parent',
    async (page) => {
      await page.getByText('Tableau de bord parent', { exact: true }).first().click();
      await page.waitForTimeout(500);
      const question = (await page.locator('[data-testid="gate-challenge"]').innerText()).trim();
      const m = question.replace(/\s/g, '').match(/^(\d+)[×x*](\d+)\+(\d+)$/);
      if (!m) throw new Error(`question inattendue : ${question}`);
      await page.locator('[data-testid="gate-answer"]').fill(String(Number(m[1]) * Number(m[2]) + Number(m[3])));
      await page.locator('[data-testid="gate-submit-answer"]').click();
      await page.waitForTimeout(900);
    },
  );

  // 5. « Les serpents dorment » : plage de coucher couvrant la journée.
  await shot(
    await makeContext(browser, {
      lang: 'fr',
      settings: { appearance: 'nuit', palette: 'nuit' },
      parental: {
        pinHash: null, puzzleQuestion: '', puzzleAnswer: '', dailyLimitMin: 0,
        bedtimeStartMin: 0, bedtimeEndMin: 23 * 60 + 59, pauseReminderMin: 0,
        soundOn: true, hapticsOn: true, hintsOn: true, notificationsOn: false,
      },
    }),
    '5-serpents-dorment',
    async () => undefined,
  );

  // 6. Tutoriel du premier lancement (aucun profil).
  await shot(
    await makeContext(browser, { lang: 'fr', settings: { appearance: 'jour', palette: 'jour' }, firstLaunch: true }),
    '6-tutoriel',
    async (page) => {
      await page.getByText('Niveau suivant', { exact: true }).first().click();
      await page.waitForTimeout(600);
    },
  );

  await browser.close();
  console.log(`\n✅ 6 captures écrites dans ${OUT}/`);
}

void main().catch((e) => {
  console.error('ERREUR', e);
  process.exit(1);
});
