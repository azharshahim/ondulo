// ─── Mini-tutoriel interactif (premier lancement) ──────────────────────────
// 3 étapes avec une main animée : glisser par la tête, par la queue, et
// entrer dans le trou de la même couleur. Passable par les adultes.
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import { IconChevronLeft, IconChevronRight, IconSkip, IconStar } from '../ui/icons';
import { sound } from '../audio/sound';

interface Step {
  key: string;
  title: string;
  text: string;
  /** Position relative de la main animée (x, y en % de la largeur). */
  hand: { x: number; y: number };
}

export default function TutorialScreen({ theme, t, onDone, onSkip }: {
  theme: Theme;
  t: Dict;
  onDone: () => void;
  onSkip: () => void;
}) {
  const { width } = useWindowDimensions();
  const [idx, setIdx] = useState(0);
  const handX = useSharedValue(20);
  const handY = useSharedValue(40);

  const steps: Step[] = [
    { key: 'head', title: t.tutorialHead, text: t.tutorialHeadText, hand: { x: 35, y: 35 } },
    { key: 'tail', title: t.tutorialTail, text: t.tutorialTailText, hand: { x: 65, y: 35 } },
    { key: 'hole', title: t.tutorialHole, text: t.tutorialHoleText, hand: { x: 50, y: 55 } },
  ];

  useEffect(() => {
    const s = steps[idx];
    handX.value = withRepeat(withTiming(s.hand.x, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    handY.value = withRepeat(withTiming(s.hand.y, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [idx, handX, handY, steps]);

  const next = () => {
    sound.play('click');
    if (idx < steps.length - 1) setIdx(idx + 1);
    else onDone();
  };
  const back = () => { sound.play('click'); if (idx > 0) setIdx(idx - 1); };

  return (
    <LinearGradient colors={theme.bgGradient} style={styles.root}>
      {/* Plateau fictif : 2 rangées de 5 cases, serpent et trou posés DESSUS
          (positions calculées à partir des mêmes constantes que les cases,
          donc parfaitement alignés sur la grille). */}
      <View style={[styles.board, { width: width - 70 }]}>
        {Array.from({ length: 10 }, (_, i) => (
          <View key={i} style={[styles.cell, { backgroundColor: theme.cell }]} />
        ))}
        {/* Serpent fictif : tête, corps et queue sur la première rangée */}
        <View style={styles.snakeBody}>
          <View style={[styles.seg, { backgroundColor: '#EF6B73' }]} />
          <View style={[styles.seg, { backgroundColor: '#9BDD4A' }]} />
          <View style={[styles.seg, { backgroundColor: '#C9A0F5' }]} />
        </View>
        {/* Trou fictif : dernière case de la seconde rangée */}
        <View style={[styles.hole, { borderColor: '#EF6B73' }]}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#0A0F24' }} />
        </View>
      </View>

      {/* Main animée */}
      <Animated.View style={[
        styles.hand,
        {
          left: `${handX.value}%`,
          top: `${handY.value}%`,
          transform: [{ scale: 1 }],
        },
      ]}>
        <Text style={{ fontSize: 30 }}>👆</Text>
      </Animated.View>

      {/* Légende */}
      <View style={styles.legend}>
        <Text style={[styles.title, { color: theme.text }]}>{steps[idx].title}</Text>
        <Text style={[styles.text, { color: theme.subtext }]}>{steps[idx].text}</Text>
      </View>

      {/* Points d'étapes */}
      <View style={styles.dots}>
        {steps.map((s, i) => (
          <View key={s.key} style={[styles.dot, { backgroundColor: i <= idx ? theme.accent2 : 'rgba(128,128,160,0.3)' }]} />
        ))}
      </View>

      {/* Boutons */}
      <View style={styles.actions}>
        <Pressable onPress={() => { sound.play('click'); onSkip(); }} style={[styles.skip]}>
          <IconSkip size={16} color={theme.subtext} />
          <Text style={{ color: theme.subtext, fontWeight: '700', fontSize: 13 }}>{t.onboardingSkip}</Text>
        </Pressable>
        {idx > 0 && (
          <Pressable onPress={back} style={[styles.btn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
            <IconChevronLeft size={18} color={theme.text} />
            <Text style={{ color: theme.text, fontWeight: '700' }}>{t.back}</Text>
          </Pressable>
        )}
        <Pressable onPress={next}
          style={[styles.btn, { backgroundColor: theme.accent, borderColor: theme.panelBorder }]}>
          <Text style={{ color: '#FFF', fontWeight: '900' }}>{idx < steps.length - 1 ? t.next : t.onboardingStart}</Text>
          <IconChevronRight size={18} color="#FFF" />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

// Géométrie de l'illustration : mêmes valeurs pour les cases et les éléments
// posés dessus (aucun décalage possible).
const CELL = 52;   // côté d'une case
const GAP = 8;     // espace entre deux cases
const PAD = 16;    // marge interne du plateau
const SEG = 26;    // diamètre d'un segment de serpent
const HOLE = 40;   // diamètre extérieur du trou
const STEP = CELL + GAP;

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  board: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GAP,
    backgroundColor: 'rgba(0,0,0,0.25)', padding: PAD, borderRadius: 20, overflow: 'hidden',
  },
  cell: { width: CELL, height: CELL, borderRadius: 12 },
  // Serpent fictif : posé sur la 2e case de la 1re rangée.
  snakeBody: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6,
    left: PAD + STEP + (CELL - SEG) / 2 + SEG / 2, top: PAD + (CELL - SEG) / 2,
  },
  seg: { width: SEG, height: SEG, borderRadius: SEG / 2 },
  // Trou fictif : posé sur la dernière case de la 2e rangée.
  hole: {
    position: 'absolute', padding: 5, borderRadius: 16, borderWidth: 3,
    backgroundColor: 'rgba(239,107,115,0.2)',
    left: PAD + 4 * STEP + (CELL - HOLE) / 2, top: PAD + STEP + (CELL - HOLE) / 2,
  },
  hand: { position: 'absolute', transform: [{ translateX: -18 }, { translateY: -18 }], zIndex: 10 },
  legend: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 20, fontWeight: '900' },
  text: { fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  // Trois éléments sur 414 px : sans flexShrink/gap, « Retour » chevauchait
  // « Passer le tutoriel ». Le libellé de saut peut se réduire, pas les boutons.
  actions: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20, gap: 8,
  },
  skip: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12,
    paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, flexShrink: 0,
  },
});
