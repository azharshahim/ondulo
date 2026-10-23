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
      {/* Plateau fictif */}
      <View style={[styles.board, { width: width - 70 }]}>
        {[0, 1, 2, 3, 4].map((c) => (
          <View key={c} style={[styles.cell, { backgroundColor: theme.cell }]} />
        ))}
        {/* Serpent fictif */}
        <View style={styles.snakeBody}>
          <View style={[styles.head, { backgroundColor: '#EF6B73' }]} />
          <View style={[styles.body, { backgroundColor: '#9BDD4A' }]} />
          <View style={[styles.tail, { backgroundColor: '#C9A0F5' }]} />
        </View>
        {/* Trou fictif */}
        <View style={[styles.hole, { borderColor: '#EF6B73' }]}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#0A0F24' }} />
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

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  board: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(0,0,0,0.25)', padding: 16, borderRadius: 20, overflow: 'hidden' },
  cell: { width: 52, height: 52, borderRadius: 12 },
  snakeBody: { flexDirection: 'row', alignItems: 'center', marginTop: 70, gap: 4 },
  head: { width: 26, height: 26, borderRadius: 13 },
  body: { width: 26, height: 26, borderRadius: 13 },
  tail: { width: 26, height: 26, borderRadius: 13 },
  hole: { marginTop: 10, marginLeft: 40, padding: 6, borderRadius: 16, borderWidth: 3, backgroundColor: 'rgba(239,107,115,0.2)' },
  hand: { position: 'absolute', transform: [{ translateX: -18 }, { translateY: -18 }], zIndex: 10 },
  legend: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 20, fontWeight: '900' },
  text: { fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  skip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1 },
});
