// ─── Fond animé : dégradé + particules flottantes ──────────────────────────
// Couche principale en React Native (dégradé + orbes Reanimated) et, sur
// mobile, une couche de particules rendue avec Skia (@shopify/react-native-skia,
// animée par les SharedValues Reanimated). Sur le web, on garde la couche RN
// seule (CanvasKit n'y est pas chargé) ; un garde-fou coupe Skia en cas
// d'erreur pour que le jeu démarre toujours.
import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, type SharedValue,
} from 'react-native-reanimated';
import type { Theme } from './theme';

// ── Orbes douces animées (Reanimated) ──────────────────────────────────────
function Orb({ x, y, size, color, duration }: { x: string; y: string; size: number; color: string; duration: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [duration, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -26 * t.value }, { translateX: 10 * t.value }],
    opacity: 0.5 + 0.3 * t.value,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute', left: x as never, top: y as never, width: size, height: size,
          borderRadius: size / 2, backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

// ── Particules Skia (mobile uniquement, avec garde-fou) ───────────────────
class SkiaGuard extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* Skia indisponible : le fond RN suffit. */ }
  render() { return this.state.failed ? null : this.props.children; }
}

interface ParticleDef { x: number; y: number; r: number; drift: number; delay: number }

function SkiaParticle({ Circle, def, color }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Circle: any; def: ParticleDef; color: string;
}) {
  const cy = useSharedValue(def.y);
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    cy.value = withRepeat(
      withTiming(def.y - def.drift, { duration: 4200 + def.delay * 900, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    opacity.value = withRepeat(
      withTiming(0.75, { duration: 1500 + def.delay * 500, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Circle cx={def.x} cy={cy as SharedValue<number>} r={def.r} color={color} opacity={opacity as SharedValue<number>} />;
}

function SkiaParticles({ theme }: { theme: Theme }) {
  // Chargement paresseux : si le module natif Skia est absent, on n'affiche rien.
  const Skia = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@shopify/react-native-skia');
    } catch {
      return null;
    }
  }, []);
  const particles = useMemo<ParticleDef[]>(
    () => Array.from({ length: 26 }, (_, i) => ({
      x: ((i * 67) % 360) + 12,
      y: ((i * 113) % 640) + 30,
      r: 1.4 + (i % 4) * 0.7,
      drift: 34 + (i % 5) * 11,
      delay: i % 6,
    })),
    [],
  );
  if (!Skia?.Canvas || !Skia?.Circle) return null;
  const { Canvas, Circle } = Skia;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((def, i) => (
        <SkiaParticle key={i} Circle={Circle} def={def} color={i % 3 === 0 ? theme.accent : theme.accent2} />
      ))}
    </Canvas>
  );
}

export default function Background({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <LinearGradient colors={theme.bgGradient} style={styles.root}>
      <Orb x="8%" y="12%" size={130} color={theme.accent} duration={5200} />
      <Orb x="72%" y="6%" size={90} color={theme.accent2} duration={4300} />
      <Orb x="80%" y="68%" size={150} color={theme.accent2} duration={6100} />
      <Orb x="-4%" y="78%" size={110} color={theme.accent} duration={4800} />
      {Platform.OS !== 'web' && (
        <SkiaGuard>
          <SkiaParticles theme={theme} />
        </SkiaGuard>
      )}
      <View style={styles.content}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
