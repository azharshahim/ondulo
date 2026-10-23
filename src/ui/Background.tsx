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

// ── Petites particules discrètes (rayon 2 à 6 px, opacité 10-25 %) ───────
// Toujours DERRIÈRE le plateau et l'interface (zIndex 0, pointerEvents
// none) : elles ne passent jamais devant un élément de jeu.
function TinyParticles({ theme }: { theme: Theme }) {
  const dots = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      left: `${(i * 41) % 96 + 2}%`,
      top: `${(i * 29) % 92 + 3}%`,
      size: 4 + (i % 5) * 2, // diamètre 4 à 12 px (rayon 2 à 6 px)
      opacity: 0.10 + (i % 4) * 0.05, // 10 % à 25 %
      duration: 3800 + (i % 6) * 700,
      color: i % 3 === 0 ? theme.accent : theme.accent2,
    })),
    [theme.accent, theme.accent2],
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
      {dots.map((d, i) => (
        <TinyDot key={i} {...d} />
      ))}
    </View>
  );
}

function TinyDot({ left, top, size, color, opacity, duration }: {
  left: string; top: string; size: number; color: string; opacity: number; duration: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [duration, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -14 * t.value }],
    opacity: opacity * (0.7 + 0.3 * t.value),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute', left: left as never, top: top as never,
          width: size, height: size, borderRadius: size / 2, backgroundColor: color,
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
  const opacity = useSharedValue(0.12);
  useEffect(() => {
    cy.value = withRepeat(
      withTiming(def.y - def.drift, { duration: 5200 + def.delay * 900, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    opacity.value = withRepeat(
      withTiming(0.25, { duration: 2100 + def.delay * 500, easing: Easing.inOut(Easing.sin) }),
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
      r: 1.6 + (i % 3) * 0.8,
      drift: 16 + (i % 5) * 6,
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
      {/* Particules discrètes, derrière tout le reste (zIndex 0). */}
      <TinyParticles theme={theme} />
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
  content: { flex: 1, zIndex: 1 },
});
