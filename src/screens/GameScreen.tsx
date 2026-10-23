// ─── Écran de jeu ──────────────────────────────────────────────────────────
// Plateau centré, barre du haut (niveau, coups — aucun minuteur), barre du
// bas (Annuler illimité, Indice avec pub simulée, Recommencer), pause/menu,
// aspiration animée, confettis et étoiles à la victoire.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle, useSharedValue, withDelay, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { Cell, End, GameState, LevelDef, MoveResult } from '../game/types';
import { buildState, cloneState, isWin, starsForMoves, tryMove } from '../game/engine';
import { findHint, moveSourceCell } from '../game/solver';
import { getDailyLevel, getLevel, todayKey, TOTAL_LEVELS } from '../levels/levels';
import type { Settings } from '../state/storage';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import Board, { type HintVisual, type SinkingInfo } from '../ui/Board';
import Confetti from '../ui/Confetti';
import {
  IconBulb, IconCalendar, IconHome, IconMap, IconNext, IconPause, IconPlay,
  IconRestart, IconSnake, IconStar, IconTv, IconUndo,
} from '../ui/icons';
import { sound } from '../audio/sound';

interface GameScreenProps {
  levelNumber: number | null; // null → défi quotidien
  settings: Settings;
  theme: Theme;
  t: Dict;
  onExitHome: () => void;
  onOpenLevels: () => void;
  onComplete: (stars: number, isDaily: boolean) => void;
  onNextLevel: () => void;
}

function Pill({ label, icon, onPress, disabled, theme, accent, style: extraStyle }: {
  label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean;
  theme: Theme; accent?: boolean; style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: accent ? theme.accent : theme.panel,
          borderColor: theme.panelBorder,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        extraStyle,
      ]}
    >
      {icon}
      <Text style={{ color: accent ? '#FFF' : theme.text, fontWeight: '700', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

function VictoryStar({ filled, delay, size }: { filled: boolean; delay: number; size: number }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(delay, withSpring(1, { damping: 7, stiffness: 160 }));
  }, [delay, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { rotate: `${(1 - s.value) * -40}deg` }] }));
  return (
    <Animated.View style={style}>
      <IconStar size={size} color={filled ? '#FFC93C' : 'rgba(128,128,160,0.35)'} />
    </Animated.View>
  );
}

export default function GameScreen({
  levelNumber, settings, theme, t, onExitHome, onOpenLevels, onComplete, onNextLevel,
}: GameScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isDaily = levelNumber === null;

  const [level, setLevel] = useState<LevelDef | null>(null);
  const [gs, setGs] = useState<GameState | null>(null);
  const [sinking, setSinking] = useState<SinkingInfo | null>(null);
  const [hint, setHint] = useState<HintVisual | null>(null);
  const [paused, setPaused] = useState(false);
  const [adOpen, setAdOpen] = useState(false);
  const [adCount, setAdCount] = useState(3);
  const [victory, setVictory] = useState<{ stars: number; moves: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const levelRef = useRef<LevelDef | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const historyRef = useRef<GameState[]>([]);
  const sinkingRef = useRef<SinkingInfo | null>(null);
  const pendingSinkRef = useRef<GameState | null>(null);
  const completedRef = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const haptic = useCallback((kind: 'step' | 'pop' | 'blocked' | 'win') => {
    if (!settings.haptics) return;
    try {
      if (kind === 'step') void Haptics.selectionAsync();
      else if (kind === 'blocked') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { /* ignore */ }
  }, [settings.haptics]);

  // Chargement différé : la génération d'un niveau peut prendre ~1 s,
  // on laisse l'écran s'afficher avec un indicateur.
  useEffect(() => {
    const timer = setTimeout(() => {
      const lvl = isDaily ? getDailyLevel(new Date()) : getLevel(levelNumber!);
      levelRef.current = lvl;
      const initial = buildState(lvl);
      stateRef.current = initial;
      setLevel(lvl);
      setGs(initial);
    }, 40);
    return () => clearTimeout(timer);
  }, [isDaily, levelNumber]);

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setGs(next);
  }, []);

  const attemptMove = useCallback((snakeId: string, end: End, target: Cell): MoveResult => {
    const lvl = levelRef.current;
    const st = stateRef.current;
    if (!lvl || !st || sinkingRef.current) return { status: 'blocked', reason: 'inconnu' };
    const res = tryMove(lvl, st, snakeId, end, target);
    if (res.status === 'moved') {
      historyRef.current.push(cloneState(st));
      setCanUndo(true);
      commit(res.state);
      setHint(null);
    } else if (res.status === 'absorbed') {
      historyRef.current.push(cloneState(st));
      setCanUndo(true);
      pendingSinkRef.current = res.state;
      const info = { snakeId, holeCell: target, end };
      sinkingRef.current = info;
      setSinking(info);
      setHint(null);
    }
    return res;
  }, [commit]);

  const onSinkDone = useCallback(() => {
    const pending = pendingSinkRef.current;
    pendingSinkRef.current = null;
    sinkingRef.current = null;
    setSinking(null);
    if (!pending) return;
    commit(pending);
    sound.play('pop');
    haptic('pop');
    if (isWin(pending) && !completedRef.current) {
      completedRef.current = true;
      const lvl = levelRef.current!;
      const stars = starsForMoves(pending.moves, lvl.optimal);
      setTimeout(() => {
        setVictory({ stars, moves: pending.moves });
        sound.play('win');
        haptic('win');
        onComplete(stars, isDaily);
      }, 380);
    }
  }, [commit, haptic, isDaily, onComplete]);

  const undo = useCallback(() => {
    if (sinkingRef.current) return;
    const prev = historyRef.current.pop();
    if (!prev) return;
    sound.play('click');
    setHint(null);
    setCanUndo(historyRef.current.length > 0);
    commit(prev);
  }, [commit]);

  const restart = useCallback(() => {
    const lvl = levelRef.current;
    if (!lvl || sinkingRef.current) return;
    sound.play('click');
    historyRef.current = [];
    setCanUndo(false);
    setHint(null);
    completedRef.current = false;
    setVictory(null);
    commit(buildState(lvl));
  }, [commit]);

  // ── Indice : pub simulée de 3 s, puis calcul du prochain bon coup ──
  useEffect(() => {
    if (!adOpen) return;
    setAdCount(3);
    const iv = setInterval(() => setAdCount((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(iv);
  }, [adOpen]);

  const showHint = useCallback(() => {
    setAdOpen(false);
    const lvl = levelRef.current;
    const st = stateRef.current;
    if (!lvl || !st) return;
    setNotice(t.generating);
    setTimeout(() => {
      setNotice(null);
      const move = findHint(lvl, st, lvl.snakes.length > 7 ? 6000 : 30000);
      if (!move) {
        setNotice(t.noHint);
        setTimeout(() => setNotice(null), 2600);
        return;
      }
      const from = moveSourceCell(st, move);
      if (!from) return;
      setHint({ snakeId: move.snakeId, end: move.end, from, target: move.target });
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHint(null), 4000);
    }, 30);
  }, [t]);

  if (!level || !gs) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.accent2} />
        <Text style={{ color: theme.subtext, marginTop: 14, fontWeight: '600' }}>{t.generating}</Text>
      </View>
    );
  }

  // Plateau sur toute la largeur moins 16 px de marge de chaque côté
  // (borné en hauteur pour rester entre les deux barres).
  const cellSize = Math.max(
    26,
    Math.floor(Math.min((screenW - 32) / level.cols, (screenH * 0.46) / level.rows)),
  );
  const boardWidth = cellSize * level.cols;
  const hasNext = !isDaily && (levelNumber ?? 0) < TOTAL_LEVELS;

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 8 }}>
      {/* Barre du haut */}
      <View style={styles.topBar} testID="top-bar">
        <Pressable
          onPress={() => { sound.play('click'); setPaused(true); }}
          style={[styles.iconBtn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
        >
          <IconPause size={19} color={theme.text} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          {isDaily ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconCalendar size={18} color={theme.text} />
              <Text style={{ color: theme.text, fontWeight: '900', fontSize: 19 }}>{t.daily}</Text>
            </View>
          ) : (
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 19 }}>
              {`${t.level} ${levelNumber}`}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <Text style={{ color: theme.subtext, fontSize: 12.5, fontWeight: '700' }}>{level.snakes.length}</Text>
            <IconSnake size={17} color={theme.subtext} />
            <Text style={{ color: theme.subtext, fontSize: 12.5, fontWeight: '600' }}>
              • {t.optimal} : {level.optimal}
            </Text>
          </View>
        </View>
        <View style={[styles.movesChip, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
          <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700' }}>{t.moves.toUpperCase()}</Text>
          <Text style={{ color: theme.text, fontSize: 19, fontWeight: '900' }}>{gs.moves}</Text>
        </View>
      </View>

      {/* Zone texte à HAUTEUR FIXE : toujours rendue, seule l'opacité
          change. Le plateau (centré dans le flex:1 ci-dessous) ne peut
          donc plus être déplacé par l'apparition/disparition des textes. */}
      <View style={styles.fixedTextZone} testID="text-zone">
        <Text
          style={{
            position: 'absolute', left: 24, right: 24, textAlign: 'center',
            color: theme.subtext, fontSize: 12, lineHeight: 17,
            opacity: gs.moves === 0 && !victory && !notice ? 1 : 0,
          }}
        >
          {levelNumber === 1 ? t.howTo : t.dragHint}
        </Text>
        <Text
          style={{
            position: 'absolute', left: 20, right: 20, textAlign: 'center',
            color: theme.accentText, fontSize: 13.5, fontWeight: '700', lineHeight: 19,
            opacity: notice ? 1 : 0,
          }}
        >
          {notice ?? ''}
        </Text>
      </View>

      {/* Plateau centré */}
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Board
          level={level}
          state={gs}
          theme={theme}
          skin={settings.skin}
          colorblind={settings.colorblind}
          boardWidth={boardWidth}
          hint={hint}
          sinking={sinking}
          attemptMove={attemptMove}
          onStep={() => { sound.play('slide'); haptic('step'); }}
          onBlockedFx={() => { sound.play('error'); haptic('blocked'); }}
          onSinkDone={onSinkDone}
        />
      </View>

      {/* Barre du bas : 16 px de marge de chaque côté, boutons de largeur égale */}
      <View style={styles.bottomBar} testID="bottom-bar">
        <Pill icon={<IconUndo size={19} color={theme.text} />} label={t.undo} theme={theme} style={{ flex: 1 }} onPress={undo} disabled={!canUndo || !!sinking} />
        <Pill icon={<IconBulb size={19} color="#FFF" />} label={t.hint} theme={theme} accent style={{ flex: 1 }} onPress={() => { sound.play('click'); setAdOpen(true); }} disabled={!!sinking || !!victory} />
        <Pill icon={<IconRestart size={19} color={theme.text} />} label={t.restart} theme={theme} style={{ flex: 1 }} onPress={restart} disabled={!!sinking} />
      </View>

      <Confetti visible={!!victory} onDone={() => undefined} />

      {/* ── Pause / menu ── */}
      <Modal visible={paused} transparent animationType="fade" onRequestClose={() => setPaused(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: theme.isDark ? '#1C1C38' : '#FFFFFF', borderColor: theme.panelBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.pause}</Text>
            <Text style={{ color: theme.subtext, fontSize: 13.5, lineHeight: 19, marginBottom: 14 }}>{t.howTo}</Text>
            {[
              { icon: <IconPlay size={18} color={theme.text} />, label: t.resume, fn: () => setPaused(false) },
              { icon: <IconRestart size={18} color={theme.text} />, label: t.restart, fn: () => { setPaused(false); restart(); } },
              { icon: <IconMap size={18} color={theme.text} />, label: t.levels, fn: () => { setPaused(false); onOpenLevels(); } },
              { icon: <IconHome size={18} color={theme.text} />, label: t.home, fn: () => { setPaused(false); onExitHome(); } },
            ].map((b) => (
              <Pressable key={b.label} onPress={() => { sound.play('click'); b.fn(); }}
                style={[styles.modalBtn, { backgroundColor: theme.panel, borderColor: theme.panelBorder, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                {b.icon}
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Publicité simulée avant l'indice ── */}
      <Modal visible={adOpen} transparent animationType="fade" onRequestClose={() => { if (adCount === 0) setAdOpen(false); }}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: theme.isDark ? '#1C1C38' : '#FFFFFF', borderColor: theme.panelBorder, alignItems: 'center' }]}>
            <IconTv size={44} color={theme.accent2} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t.adTitle}</Text>
            <Text style={{ color: theme.subtext, fontSize: 13.5, textAlign: 'center', marginBottom: 14 }}>{t.adText}</Text>
            <View style={{ width: '100%', height: 8, borderRadius: 4, backgroundColor: theme.panel, overflow: 'hidden', marginBottom: 16 }}>
              <View style={{ width: `${((3 - adCount) / 3) * 100}%`, height: '100%', backgroundColor: theme.accent2 }} />
            </View>
            <Pressable
              onPress={showHint}
              disabled={adCount > 0}
              style={[styles.modalBtn, { backgroundColor: adCount > 0 ? theme.panel : theme.accent, borderColor: theme.panelBorder, alignSelf: 'stretch', alignItems: 'center' }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center' }}>
                {/* Emplacement d'icône toujours présent (opacité seule) et
                    texte à boîte fixe : la géométrie du bouton ne change
                    jamais quand son libellé change (CLS = 0). */}
                <View style={{ opacity: adCount === 0 ? 1 : 0 }}>
                  <IconBulb size={18} color="#FFF" />
                </View>
                {/* Libellés superposés (opacité seule) : aucun changement
                    de contenu donc aucun micro-décalage du texte. */}
                <View style={{ flex: 1, height: 20, position: 'relative' }}>
                  <Text style={{
                    position: 'absolute', left: 0, right: 0, top: 0, textAlign: 'center',
                    color: theme.subtext, fontWeight: '800', fontSize: 15,
                    opacity: adCount > 0 ? 1 : 0,
                  }}>
                    {`${t.adWait}… ${adCount}s`}
                  </Text>
                  <Text style={{
                    position: 'absolute', left: 0, right: 0, top: 0, textAlign: 'center',
                    color: '#FFF', fontWeight: '800', fontSize: 15,
                    opacity: adCount === 0 ? 1 : 0,
                  }}>
                    {t.adShowHint}
                  </Text>
                </View>
                <View style={{ width: 18 }} />
              </View>
            </Pressable>
            {/* Zone « Fermer » toujours présente (opacité seule) : la
                carte ne change jamais de taille → aucun layout shift. */}
            <Pressable
              onPress={() => { if (adCount === 0) setAdOpen(false); }}
              style={{ marginTop: 10, height: 24, justifyContent: 'center', opacity: adCount === 0 ? 1 : 0 }}
            >
              <Text style={{ color: theme.subtext, fontWeight: '600' }}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Victoire ── */}
      {victory && (
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: theme.isDark ? '#1C1C38' : '#FFFFFF', borderColor: theme.panelBorder, alignItems: 'center' }]}>
            <Text style={{ fontSize: 21, fontWeight: '900', color: theme.text }}>{t.victory}</Text>
            <View style={{ flexDirection: 'row', marginVertical: 10, gap: 4 }}>
              {[1, 2, 3].map((i) => (
                <VictoryStar key={i} filled={i <= victory.stars} delay={250 + i * 260} size={46} />
              ))}
            </View>
            <Text style={{ color: theme.subtext, fontSize: 14, marginBottom: 4 }}>{t.victoryText}</Text>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginBottom: 16 }}>
              {t.moves} : {victory.moves} • {t.optimal} : {level.optimal}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Pill icon={<IconRestart size={18} color={theme.text} />} label={t.replay} theme={theme} onPress={() => { setVictory(null); restart(); }} />
              <Pill icon={<IconMap size={18} color={theme.text} />} label={t.levels} theme={theme} onPress={() => { sound.play('click'); onOpenLevels(); }} />
              {hasNext && (
                <Pill icon={<IconNext size={18} color="#FFF" />} label={t.next} theme={theme} accent onPress={() => { sound.play('click'); onNextLevel(); }} />
              )}
              {isDaily && (
                <Pill icon={<IconHome size={18} color="#FFF" />} label={t.home} theme={theme} accent onPress={() => { sound.play('click'); onExitHome(); }} />
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  fixedTextZone: { height: 38, marginTop: 2, justifyContent: 'center', position: 'relative' },
  iconBtn: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  movesChip: {
    minWidth: 64, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1,
    alignItems: 'center',
  },
  bottomBar: {
    flexDirection: 'row', justifyContent: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingHorizontal: 15, paddingVertical: 11, borderRadius: 999, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 5, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  modalBg: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(5,5,20,0.62)',
    alignItems: 'center', justifyContent: 'center', padding: 22,
  },
  modalCard: {
    width: '100%', maxWidth: 380, borderRadius: 24, borderWidth: 1, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalTitle: { fontSize: 19, fontWeight: '900', marginBottom: 8 },
  modalBtn: {
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, marginBottom: 9,
  },
});
