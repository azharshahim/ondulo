// ─── Écran d'accueil : logo animé, Jouer / Niveaux / Défi / Réglages ───────
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import {
  IconCalendar, IconChevronRight, IconLock, IconMap, IconPlay, IconSettings, IconSnake, IconStar,
} from '../ui/icons';
import { sound } from '../audio/sound';

interface HomeScreenProps {
  theme: Theme;
  t: Dict;
  currentLevel: number;
  totalStars: number;
  dailyDone: boolean;
  onPlay: () => void;
  onLevels: () => void;
  onDaily: () => void;
  onSettings: () => void;
  onProfiles: () => void;
  onParental: () => void;
}

/** Petit serpent-logo dessiné en vues, qui respire et ondule doucement. */
function LogoSnake() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t]);
  const segments = ['#F2D94E', '#9BDD4A', '#0A9BEF', '#C9A0F5', '#E89BDD'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      {segments.map((color, i) => (
        <LogoSegment key={i} color={color} index={i} phase={t} isHead={i === segments.length - 1} />
      ))}
    </View>
  );
}

function LogoSegment({ color, index, phase, isHead }: {
  color: string; index: number; phase: SharedValue<number>; isHead: boolean;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.sin(phase.value * Math.PI + index * 0.85) * 6 },
      { scale: 1 + 0.05 * Math.sin(phase.value * Math.PI * 2 + index) },
    ],
  }));
  return (
    <Animated.View style={[{
      width: 44, height: 44, borderRadius: isHead ? 21 : 15, backgroundColor: color,
      marginLeft: index === 0 ? 0 : -7,
      borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
      shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
      elevation: 5, alignItems: 'center', justifyContent: 'center', zIndex: index,
    }, style]}>
      {isHead && (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{
              width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#182238' }} />
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function MenuButton({ icon, label, sub, onPress, theme, primary }: {
  icon: React.ReactNode; label: string; sub?: string; onPress: () => void; theme: Theme; primary?: boolean;
}) {
  const content = (
    <>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ color: primary ? '#FFF' : theme.text, fontWeight: '900', fontSize: 17.5 }}>{label}</Text>
        {!!sub && (
          <Text style={{ color: primary ? 'rgba(255,255,255,0.85)' : theme.subtext, fontSize: 12.5, fontWeight: '600' }}>{sub}</Text>
        )}
      </View>
      <IconChevronRight size={20} color={primary ? '#FFF' : theme.subtext} />
    </>
  );
  const style = ({ pressed }: { pressed: boolean }) => [
    styles.menuBtn,
    { borderColor: theme.panelBorder, opacity: pressed ? 0.78 : 1 },
    !primary && { backgroundColor: theme.panel },
  ];
  if (primary) {
    return (
      <Pressable onPress={onPress} style={style}>
        <LinearGradient colors={[theme.accent, theme.accent2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
        {content}
      </Pressable>
    );
  }
  return <Pressable onPress={onPress} style={style}>{content}</Pressable>;
}

export default function HomeScreen({
  theme, t, currentLevel, totalStars, dailyDone, onPlay, onLevels, onDaily, onSettings, onProfiles, onParental,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const click = (fn: () => void) => () => { sound.play('click'); fn(); };
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 26, paddingBottom: insets.bottom + 18, paddingHorizontal: 24 }}>
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <LogoSnake />
          <Text style={{ color: theme.text, fontSize: 35, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' }}>
            Ondulo
          </Text>
        <Text style={{ color: theme.subtext, fontSize: 14.5, fontWeight: '600', marginTop: 5, textAlign: 'center' }}>
          {t.tagline}
        </Text>
        <View style={[styles.starsChip, { backgroundColor: theme.panel, borderColor: theme.panelBorder, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          <IconStar size={16} />
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 14 }}>{totalStars} {t.stars}</Text>
        </View>
      </View>

      <View style={{ gap: 13, marginTop: 38 }}>
        <MenuButton icon={<IconPlay size={24} color="#FFF" />} label={t.play} sub={`${t.level} ${currentLevel}`} theme={theme} primary onPress={click(onPlay)} />
        <MenuButton icon={<IconMap size={24} color={theme.text} />} label={t.levels} theme={theme} onPress={click(onLevels)} />
        <MenuButton icon={<IconCalendar size={24} color={theme.text} />} label={t.daily} sub={dailyDone ? t.dailyDone : undefined} theme={theme} onPress={click(onDaily)} />
        <MenuButton icon={<IconSnake size={24} color={theme.text} />} label={t.profiles} theme={theme} onPress={click(onProfiles)} />
        <MenuButton icon={<IconLock size={24} color={theme.text} />} label={t.parentalDashboard} theme={theme} onPress={click(onParental)} />
        <MenuButton icon={<IconSettings size={24} color={theme.text} />} label={t.settings} theme={theme} onPress={click(onSettings)} />
      </View>

      <Text style={{
        color: theme.subtext, fontSize: 12, textAlign: 'center', marginTop: 'auto', lineHeight: 17,
      }}>
        {t.howTo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  menuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: 18, paddingVertical: 16, borderRadius: 20, borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 7, shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  starsChip: {
    marginTop: 14, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
});
