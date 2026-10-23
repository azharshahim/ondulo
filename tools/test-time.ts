// ─── Tests des règles de temps (npm run test:time) ─────────────────────────
// Toute la logique tourne sur une HORLOGE SIMULÉE (aucune attente réelle) :
//   1. limite quotidienne atteinte puis prolongation par code parental ;
//   2. plage de coucher (y compris une plage qui passe minuit) ;
//   3. rappel de pause toutes les X minutes, et son acquittement ;
//   4. enchaînements réalistes (coucher + limite + prolongation qui expire).
import {
  createPlayClock, isInBedtime, minutesOfDay, EXTENSION_MIN,
  type TimeRuleConfig,
} from '../src/state/timeRules';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
}

/** Date locale fixe : 2026-06-15 14:00:00 (aucune plage de coucher active). */
const DAY = new Date(2026, 5, 15, 14, 0, 0, 0).getTime();
const MIN = 60_000;

const cfg = (over: Partial<TimeRuleConfig> = {}): TimeRuleConfig => ({
  dailyLimitMin: 0,
  bedtimeStartMin: 20 * 60,
  bedtimeEndMin: 7 * 60,
  pauseReminderMin: 0,
  ...over,
});

/** Horloge simulée : on avance à la demande, sans dormir. */
function fakeClock(startMs: number) {
  let t = startMs;
  return {
    now: () => t,
    advanceMin: (m: number) => { t += m * MIN; },
    set: (ms: number) => { t = ms; },
    get: () => t,
  };
}

function main(): void {
  console.log('── 0. Primitives ──');
  check('minutesOfDay(14h00) = 840', minutesOfDay(DAY) === 840);
  check('plage 20h→7h contient 22h', isInBedtime(22 * 60, 20 * 60, 7 * 60));
  check('plage 20h→7h contient 3h', isInBedtime(3 * 60, 20 * 60, 7 * 60));
  check('plage 20h→7h exclut 12h', !isInBedtime(12 * 60, 20 * 60, 7 * 60));
  check('plage 20h→7h exclut 7h (borne de fin)', !isInBedtime(7 * 60, 20 * 60, 7 * 60));
  check('plage vide (start = end) n’exclut jamais', !isInBedtime(22 * 60, 8 * 60, 8 * 60));

  console.log('── 1. Limite quotidienne atteinte ──');
  {
    const c = fakeClock(DAY);
    const clock = createPlayClock({ config: cfg({ dailyLimitMin: 30 }), now: c.now });

    clock.start();
    c.advanceMin(10);
    check('après 10 min de jeu : statut ok', clock.status().kind === 'ok');
    check('minutes restantes ≈ 20', Math.round(clock.status().remainingMin) === 20);

    // Le temps ne s'accumule pas hors jeu.
    clock.stop();
    c.advanceMin(60);
    check('60 min hors jeu n’entament pas la limite', clock.status().playedMin === 10);

    clock.start();
    c.advanceMin(19);
    check('29 min jouées : toujours autorisé', clock.status().kind === 'ok');
    c.advanceMin(1);
    const st = clock.status();
    check('30 min atteintes : jeu bloqué (statut « limit »)', st.kind === 'limit');
    check('minutes restantes = 0', st.remainingMin === 0);
    check('temps joué = 30 min', st.playedMin === 30);

    // Prolongation par code parental (le PIN est vérifié en amont par la porte).
    const until = clock.extend(EXTENSION_MIN);
    check(`prolongation de ${EXTENSION_MIN} min accordée`, until === c.get() + EXTENSION_MIN * MIN);
    check('jeu de nouveau autorisé pendant la prolongation', clock.status().kind === 'ok');
    c.advanceMin(EXTENSION_MIN - 1);
    check(`après ${EXTENSION_MIN - 1} min de prolongation : encore autorisé`, clock.status().kind === 'ok');
    c.advanceMin(2);
    check('prolongation expirée : jeu bloqué à nouveau', clock.status().kind === 'limit');
  }

  console.log('── 2. Plage de coucher ──');
  {
    const c = fakeClock(DAY);
    const clock = createPlayClock({ config: cfg(), now: c.now });

    clock.start();
    c.advanceMin(5);
    check('14h : autorisé', clock.status().kind === 'ok');

    c.set(new Date(2026, 5, 15, 20, 30, 0).getTime());   // 20h30
    check('20h30 : bloqué (coucher)', clock.status().kind === 'bedtime');

    c.set(new Date(2026, 5, 16, 2, 0, 0).getTime());     // lendemain 2h
    check('2h du matin : toujours bloqué (plage qui passe minuit)', clock.status().kind === 'bedtime');

    c.set(new Date(2026, 5, 16, 7, 0, 0).getTime());     // 7h00 pile
    check('7h00 : autorisé (fin de plage exclue)', clock.status().kind === 'ok');

    // Le blocage « coucher » ne dépend pas du temps joué : même 0 minute.
    c.set(new Date(2026, 5, 16, 22, 0, 0).getTime());
    const fresh = createPlayClock({ config: cfg(), now: c.now });
    check('coucher à 22h avec 0 minute jouée : bloqué', fresh.status().kind === 'bedtime');

    // Prolongation également valable pour le coucher.
    fresh.extend(EXTENSION_MIN);
    check('prolongation parentale pendant le coucher : autorisé', fresh.status().kind === 'ok');
    c.advanceMin(EXTENSION_MIN + 1);
    check('prolongation expirée pendant le coucher : bloqué', fresh.status().kind === 'bedtime');

    // Réglage « pas de plage » : start = end.
    const noBed = createPlayClock({ config: cfg({ bedtimeStartMin: 0, bedtimeEndMin: 0 }), now: c.now });
    check('plage de coucher désactivée (0h-0h) : autorisé la nuit', noBed.status().kind === 'ok');
  }

  console.log('── 3. Rappel de pause ──');
  {
    const c = fakeClock(DAY);
    const clock = createPlayClock({ config: cfg({ pauseReminderMin: 20 }), now: c.now });

    clock.start();
    c.advanceMin(19);
    check('19 min : pas de rappel', clock.status().kind === 'ok');
    c.advanceMin(1);
    check('20 min : rappel de pause', clock.status().kind === 'pause');

    clock.acknowledgePause();
    check('rappel acquitté : plus de rappel immédiat', clock.status().kind === 'ok');
    c.advanceMin(19);
    check('19 min après acquittement : pas de rappel', clock.status().kind === 'ok');
    c.advanceMin(1);
    check('40 min jouées : nouveau rappel', clock.status().kind === 'pause');

    // Une prolongation remet aussi le compteur de pause à zéro.
    clock.extend(EXTENSION_MIN);
    check('prolongation : statut ok', clock.status().kind === 'ok');
    check('le rappel de pause ne se déclenche pas pendant la prolongation',
      clock.status().kind === 'ok');

    const none = createPlayClock({
      config: cfg({ pauseReminderMin: 0, bedtimeStartMin: 0, bedtimeEndMin: 0 }), now: c.now,
    });
    none.start();
    c.advanceMin(500);
    check('rappel désactivé (0 min) : jamais déclenché', none.status().kind === 'ok');
  }

  console.log('── 4. Enchaînements ──');
  {
    // 19h00, limite 20 min, coucher à 20h : la limite tombe avant le coucher,
    // puis la prolongation repousse tout, puis le coucher reprend la main.
    const c = fakeClock(new Date(2026, 5, 15, 19, 0, 0).getTime());
    const clock = createPlayClock({ config: cfg({ dailyLimitMin: 20, pauseReminderMin: 0 }), now: c.now });
    clock.start();
    c.advanceMin(20);
    check('19h20 : 20 min jouées, avant le coucher → limite atteinte', clock.status().kind === 'limit');
    clock.extend(EXTENSION_MIN);
    check('prolongation de 15 min : jeu repris jusqu’à 19h35', clock.status().kind === 'ok');
    c.advanceMin(16);
    check('19h36 : prolongation expirée → limite à nouveau', clock.status().kind === 'limit');
    // Une nouvelle prolongation franchit l'heure du coucher : le coucher reprend
    // la main dès qu'elle expire (priorité au coucher sur la limite).
    clock.extend(EXTENSION_MIN);
    check('seconde prolongation : autorisé', clock.status().kind === 'ok');
    c.set(new Date(2026, 5, 15, 20, 0, 0).getTime());
    check('20h00 : coucher prioritaire sur la limite', clock.status().kind === 'bedtime');
  }

  {
    // Remise à zéro du temps joué au changement de jour.
    const c = fakeClock(new Date(2026, 5, 15, 23, 0, 0).getTime());
    const clock = createPlayClock({ config: cfg({ dailyLimitMin: 30, bedtimeStartMin: 0, bedtimeEndMin: 0 }), now: c.now });
    clock.start();
    c.advanceMin(30);
    check('limite atteinte le 15', clock.status().kind === 'limit');
    clock.stop();
    const changed = clock.resetIfNewDay('2026-06-16');
    check('changement de jour détecté', changed);
    check('temps remis à zéro le lendemain', clock.status().kind === 'ok' && clock.status().playedMin === 0);
    check('même jour : pas de remise à zéro', clock.resetIfNewDay('2026-06-16') === false);
  }

  console.log(failed
    ? `\n❌ ${failed} vérification(s) en échec, ${passed} réussie(s).`
    : `\n✅ Règles de temps : ${passed} vérifications réussies (horloge simulée).`);
  process.exit(failed ? 1 : 0);
}

main();
