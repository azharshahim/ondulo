// ─── Écran « Les serpents dorment » ─────────────────────────────────────────
// Limite atteinte : écran doux, sans culpabiliser. Le PIN prolonge.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import { IconLock } from '../ui/icons';
import { sound } from '../audio/sound';

const SEGMENTS = ['#F2D94E', '#9BDD4A', '#0A9BEF', '#C9A0F5', '#E89BDD'];

export default function SleepScreen({ theme, t, onExtend }: {
  theme: Theme;
  t: Dict;
  onExtend: () => void;
}) {
  const { width } = useWindowDimensions();
  const snooze = useSharedValue(0);
  useEffect(() => {
    snooze.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [snooze]);

  return (
    <LinearGradient colors={theme.bgGradient} style={styles.root}>
      <View style={[styles.snake, { left: width / 2 - 150 }]}>
        {SEGMENTS.map((c, i) => {
          const style = useAnimatedStyle(() => ({
            translateY: snooze.value * 14 * Math.sin(i * 0.9),
            opacity: 1 - snooze.value * 0.35,
          }));
          return (
            <Animated.View key={i} style={[styles.seg, { backgroundColor: c, left: i * 40 }, style]}>
              <Text style={styles.zzz}>{i === 4 ? '😴' : ''}</Text>
            </Animated.View>
          );
        })}
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{t.sleepTitle}</Text>
      <Text style={[styles.text, { color: theme.subtext }]}>{t.sleepText}</Text>
      <Pressable onPress={() => { sound.play('click'); onExtend(); }}
        style={[styles.btn, { backgroundColor: theme.accent, borderColor: theme.panelBorder }]}>
        <IconLock size={20} color="#FFF" />
        <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>{t.sleepExtend}</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: '18%' },
  snake: { position: 'absolute', top: '12%', width: 300, height: 52 },
  seg: { position: 'absolute', width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  zzz: { fontSize: 20 },
  title: { fontSize: 26, fontWeight: '900', marginTop: '30%' },
  text: { fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 30 },
  btn: { marginTop: 28, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
