// ─── Explosion de confettis (Reanimated, aucun asset) ──────────────────────
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing, runOnJS,
} from 'react-native-reanimated';

const CONFETTI_COLORS = ['#FF5964', '#FFC93C', '#8BD450', '#3FA7FF', '#9B5DE5', '#F15BB5', '#FF8C42'];

function Piece({ index, onDone }: { index: number; onDone: () => void }) {
  const cfg = useMemo(() => ({
    left: Math.random() * 100,
    size: 6 + Math.random() * 7,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    delay: Math.random() * 350,
    duration: 1900 + Math.random() * 1400,
    drift: (Math.random() - 0.5) * 130,
    turns: 2 + Math.random() * 4,
    round: Math.random() > 0.5,
  }), [index]);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      cfg.delay,
      withTiming(1, { duration: cfg.duration, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished && index === 0) runOnJS(onDone)();
      }),
    );
  }, [cfg, index, onDone, p]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -30 + p.value * 620 },
      { translateX: p.value * cfg.drift },
      { rotate: `${p.value * cfg.turns * 360}deg` },
    ],
    opacity: 1 - Math.max(0, p.value - 0.82) * 5,
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute', top: 0, left: `${cfg.left}%` as never,
          width: cfg.size, height: cfg.size * (cfg.round ? 1 : 0.55),
          borderRadius: cfg.round ? cfg.size / 2 : 2, backgroundColor: cfg.color,
        },
        style,
      ]}
    />
  );
}

export default function Confetti({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 42 }, (_, i) => (
        <Piece key={i} index={i} onDone={onDone} />
      ))}
    </View>
  );
}
