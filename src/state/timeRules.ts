// ─── Règles de temps : limite quotidienne, coucher, pause ──────────────────
// Logique pure (aucun import natif) et horloge INJECTÉE : entièrement
// testable avec une horloge simulée (tools/test-time.ts).
//
//  • limite quotidienne : après N minutes de jeu effectif, le jeu se ferme
//    sur l'écran « Les serpents dorment » ;
//  • plage de coucher : aucun jeu entre bedtimeStartMin et bedtimeEndMin
//    (plage pouvant passer minuit, ex. 20h → 7h) ;
//  • rappel de pause : toutes les X minutes de jeu, une pause est proposée ;
//  • prolongation : seul un code parental correct (PIN ou calcul) ouvre une
//    fenêtre supplémentaire de EXTENSION_MIN minutes, une seule fois par
//    session et par type de blocage.

export interface TimeRuleConfig {
  /** Limite quotidienne en minutes (0 = pas de limite). */
  dailyLimitMin: number;
  /** Début de la plage de coucher, en minutes depuis minuit. */
  bedtimeStartMin: number;
  /** Fin de la plage de coucher, en minutes depuis minuit. */
  bedtimeEndMin: number;
  /** Rappel de pause toutes les X minutes (0 = désactivé). */
  pauseReminderMin: number;
}

/** Durée d'une prolongation accordée par le code parental (minutes). */
export const EXTENSION_MIN = 15;

export type PlayStatusKind = 'ok' | 'bedtime' | 'limit' | 'pause';

export interface PlayStatus {
  kind: PlayStatusKind;
  /** Minutes jouées aujourd'hui (arrondi inférieur). */
  playedMin: number;
  /** Minutes restantes avant la limite (Infinity si pas de limite). */
  remainingMin: number;
  /** Fin de la prolongation en cours (ms epoch), 0 si aucune. */
  overrideUntil: number;
}

/** Minutes écoulées depuis minuit (heure locale). */
export function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** Vrai si `min` tombe dans la plage [start, end), qui peut passer minuit. */
export function isInBedtime(min: number, start: number, end: number): boolean {
  if (start === end) return false;              // plage vide
  if (start < end) return min >= start && min < end;
  return min >= start || min < end;             // passe minuit (20h → 7h)
}

export interface PlayClockOptions {
  config: TimeRuleConfig;
  /** Horloge injectable (ms epoch). */
  now?: () => number;
}

/**
 * Horloge de jeu : n'accumule du temps que lorsque le jeu est actif, gère
 * la limite, la plage de coucher, le rappel de pause et les prolongations.
 */
export function createPlayClock({ config, now = () => Date.now() }: PlayClockOptions) {
  let cfg = config;
  let playedMs = 0;
  let runningSince: number | null = null;
  let lastPauseAtMs = 0;          // palier de pause déjà signalé
  let overrideUntil = 0;          // fin de la prolongation par code parental
  let overrideKind: PlayStatusKind | null = null;

  const elapsed = (): number => {
    const live = runningSince === null ? 0 : Math.max(0, now() - runningSince);
    return playedMs + live;
  };

  /** Met à jour la configuration (réglages parentaux). */
  const configure = (next: TimeRuleConfig): void => { cfg = next; };

  const start = (): void => {
    if (runningSince === null) runningSince = now();
  };

  const stop = (): void => {
    if (runningSince !== null) {
      playedMs += Math.max(0, now() - runningSince);
      runningSince = null;
    }
  };

  /** Fin de journée locale : remise à zéro du temps joué. */
  const resetIfNewDay = (dayKey: string): boolean => {
    const last = lastDay;
    if (last === dayKey) return false;
    lastDay = dayKey;
    playedMs = 0;
    lastPauseAtMs = 0;
    if (runningSince !== null) runningSince = now();
    return true;
  };
  let lastDay: string | null = null;

  /** Accorde une prolongation de `minutes` (par défaut EXTENSION_MIN). */
  const extend = (minutes: number = EXTENSION_MIN): number => {
    const current = status();
    overrideKind = current.kind === 'ok' || current.kind === 'pause' ? null : current.kind;
    overrideUntil = now() + minutes * 60_000;
    lastPauseAtMs = elapsed();
    return overrideUntil;
  };

  /** Statut courant, par ordre de priorité : prolongation, coucher, limite, pause. */
  const status = (): PlayStatus => {
    const played = elapsed();
    const t = now();
    const remaining = cfg.dailyLimitMin > 0
      ? Math.max(0, cfg.dailyLimitMin - played / 60_000)
      : Infinity;

    if (overrideUntil > t) {
      return { kind: 'ok', playedMin: Math.floor(played / 60_000), remainingMin: remaining, overrideUntil };
    }
    overrideKind = null;

    if (isInBedtime(minutesOfDay(t), cfg.bedtimeStartMin, cfg.bedtimeEndMin)) {
      return { kind: 'bedtime', playedMin: Math.floor(played / 60_000), remainingMin: remaining, overrideUntil: 0 };
    }
    if (cfg.dailyLimitMin > 0 && played >= cfg.dailyLimitMin * 60_000) {
      return { kind: 'limit', playedMin: Math.floor(played / 60_000), remainingMin: 0, overrideUntil: 0 };
    }
    const pauseMs = cfg.pauseReminderMin * 60_000;
    if (cfg.pauseReminderMin > 0 && played - lastPauseAtMs >= pauseMs) {
      return { kind: 'pause', playedMin: Math.floor(played / 60_000), remainingMin: remaining, overrideUntil: 0 };
    }
    return { kind: 'ok', playedMin: Math.floor(played / 60_000), remainingMin: remaining, overrideUntil: 0 };
  };

  /** Le parent (ou l'enfant) a vu le rappel de pause : on repart pour un tour. */
  const acknowledgePause = (): void => {
    lastPauseAtMs = elapsed();
  };

  /** Accès en lecture pour les tests et l'affichage. */
  const snapshot = () => ({
    playedMs: elapsed(),
    running: runningSince !== null,
    lastPauseAtMs,
    overrideUntil,
    overrideKind,
  });

  return {
    configure, start, stop, status, extend, acknowledgePause, resetIfNewDay, snapshot,
  };
}

export type PlayClock = ReturnType<typeof createPlayClock>;
