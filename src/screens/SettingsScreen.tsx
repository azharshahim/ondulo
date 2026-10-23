// ─── Réglages : son, musique, vibrations, langue, thème, skins, daltonien ──
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SKINS, type Settings, type SkinId, type ThemeId } from '../state/storage';
import type { Dict } from '../i18n';
import { LANG_LIST, type Lang } from '../i18n';
import type { Theme } from '../ui/theme';
import {
  IconChevronLeft, IconEye, IconLock, IconMoon, IconMusic, IconSnake, IconSound,
  IconAuto, IconCalendar, IconSparkle, IconStar, IconSun, IconVibrate,
} from '../ui/icons';
import { sound } from '../audio/sound';

interface SettingsScreenProps {
  theme: Theme;
  t: Dict;
  settings: Settings;
  totalStars: number;
  onChange: (patch: Partial<Settings>) => void;
  onBack: () => void;
}

const SKIN_NAMES: Record<SkinId, keyof Dict> = {
  classique: 'skinClassique',
  rayures: 'skinRayures',
  pois: 'skinPois',
  degrade: 'skinDegrade',
  arcenciel: 'skinArcEnCiel',
};

const SKIN_PREVIEW: Record<SkinId, [string, string, ...string[]]> = {
  classique: ['#F8B4B9', '#EF6B73'],
  rayures: ['#6EC6FF', '#0A9BEF'],
  pois: ['#C4EE8E', '#9BDD4A'],
  degrade: ['#F9E784', '#F2D94E', '#C9A227'],
  arcenciel: ['#EF6B73', '#F2D94E', '#9BDD4A', '#0A9BEF', '#C9A0F5'],
};

export default function SettingsScreen({
  theme, t, settings, totalStars, onChange, onBack,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const Row = ({ icon, label, value, onToggle }: {
    icon: React.ReactNode; label: string; value: boolean; onToggle: (v: boolean) => void;
  }) => (
    <View style={[styles.row, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
      {icon}
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => { sound.play('click'); onToggle(v); }}
        trackColor={{ true: theme.accent2, false: 'rgba(130,130,160,0.4)' }}
        thumbColor="#FFF"
      />
    </View>
  );
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: theme.subtext, fontWeight: '800', fontSize: 12.5, letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
  const Chip = ({ label, icon, selected, onPress }: {
    label: string; icon?: React.ReactNode; selected: boolean; onPress: () => void;
  }) => (
    <Pressable
      onPress={() => { sound.play('click'); onPress(); }}
      style={[styles.chip, {
        backgroundColor: selected ? theme.accent : theme.panel,
        borderColor: selected ? theme.accent : theme.panelBorder,
        flexDirection: 'row', alignItems: 'center', gap: 7,
      }]}
    >
      {icon}
      <Text style={{ color: selected ? '#FFF' : theme.text, fontWeight: '800', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { sound.play('click'); onBack(); }}
          style={[styles.backBtn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
        >
          <IconChevronLeft size={20} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 21, fontWeight: '900' }}>{t.settings}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <Section title={t.sound}>
          <Row icon={<IconSound size={21} color={theme.text} />} label={t.sound} value={settings.sound} onToggle={(v) => onChange({ sound: v })} />
          <Row icon={<IconMusic size={21} color={theme.text} />} label={t.music} value={settings.music} onToggle={(v) => onChange({ music: v })} />
          <Row icon={<IconVibrate size={21} color={theme.text} />} label={t.haptics} value={settings.haptics} onToggle={(v) => onChange({ haptics: v })} />
          <Row icon={<IconEye size={21} color={theme.text} />} label={t.colorblind} value={settings.colorblind} onToggle={(v) => onChange({ colorblind: v })} />
        </Section>

        <Section title={t.language}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {LANG_LIST.map((l) => (
              <Chip
                key={l.id}
                label={l.name}
                selected={settings.lang === l.id}
                onPress={() => onChange({ lang: l.id })}
              />
            ))}
          </View>
        </Section>

        <Section title={t.theme}>
          <Text style={{ color: theme.subtext, fontSize: 12.5, fontWeight: '600', marginBottom: 8 }}>
            {t.appearanceAuto}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {([
              { id: 'auto' as const, label: t.appearanceAuto, icon: <IconAuto size={17} color={settings.appearance === 'auto' ? '#FFF' : theme.text} /> },
              { id: 'jour' as const, label: t.appearanceDay, icon: <IconSun size={17} color={settings.appearance === 'jour' ? '#FFF' : theme.text} /> },
              { id: 'nuit' as const, label: t.appearanceNight, icon: <IconMoon size={17} color={settings.appearance === 'nuit' ? '#FFF' : theme.text} /> },
              { id: 'scheduled' as const, label: t.appearanceScheduled, icon: <IconCalendar size={17} color={settings.appearance === 'scheduled' ? '#FFF' : theme.text} /> },
            ]).map((th) => (
              <Chip key={th.id} label={th.label} icon={th.icon} selected={settings.appearance === th.id}
                onPress={() => onChange({ appearance: th.id })} />
            ))}
          </View>
          {settings.appearance === 'scheduled' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Chip label={`${t.nightStart} 20:00`} selected={true} onPress={() => onChange({ nightStart: 20 * 60 })} />
              <Chip label={`${t.nightEnd} 07:00`} selected={true} onPress={() => onChange({ nightEnd: 7 * 60 })} />
            </View>
          )}
          <Text style={{ color: theme.subtext, fontSize: 12.5, fontWeight: '600', marginTop: 10, marginBottom: 8 }}>
            {t.palette}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {([
              { id: 'jour' as const, label: t.paletteDay, icon: <IconSun size={17} color={settings.palette === 'jour' ? '#FFF' : theme.text} /> },
              { id: 'nuit' as const, label: t.paletteNight, icon: <IconMoon size={17} color={settings.palette === 'nuit' ? '#FFF' : theme.text} /> },
              { id: 'neon' as const, label: t.paletteNeon, icon: <IconSparkle size={17} color={settings.palette === 'neon' ? '#FFF' : theme.text} /> },
            ]).map((th) => (
              <Chip key={th.id} label={th.label} icon={th.icon} selected={settings.palette === th.id}
                onPress={() => onChange({ palette: th.id })} />
            ))}
          </View>
        </Section>

        <Section title={`${t.skins} (${totalStars})`}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 11 }}>
            {SKINS.map((skin) => {
              const unlocked = totalStars >= skin.starsRequired;
              const selected = settings.skin === skin.id;
              return (
                <Pressable
                  key={skin.id}
                  disabled={!unlocked}
                  onPress={() => { sound.play('click'); onChange({ skin: skin.id }); }}
                  style={[styles.skinCard, {
                    backgroundColor: theme.panel,
                    borderColor: selected ? theme.accent : theme.panelBorder,
                    borderWidth: selected ? 2.5 : 1,
                    opacity: unlocked ? 1 : 0.55,
                  }]}
                >
                  <LinearGradient colors={SKIN_PREVIEW[skin.id]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.skinPreview}>
                    {skin.id === 'rayures' && [0.25, 0.55, 0.85].map((f) => (
                      <View key={f} style={{
                        position: 'absolute', left: -6, right: -6, top: 34 * f, height: 5,
                        backgroundColor: 'rgba(255,255,255,0.35)', transform: [{ rotate: '20deg' }],
                      }} />
                    ))}
                    {skin.id === 'pois' && [8, 26, 44].map((left, i) => (
                      <View key={i} style={{
                        position: 'absolute', left, top: i % 2 ? 8 : 20, width: 9, height: 9,
                        borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.45)',
                      }} />
                    ))}
                    {unlocked
                      ? <IconSnake size={22} color="#FFFFFF" />
                      : <IconLock size={19} color="#FFFFFF" />}
                  </LinearGradient>
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12, textAlign: 'center' }}>
                    {t[SKIN_NAMES[skin.id]]}
                  </Text>
                  {!unlocked && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Text style={{ color: theme.subtext, fontSize: 10.5, fontWeight: '600' }}>{t.unlockAt}</Text>
                      <IconStar size={11} />
                      <Text style={{ color: theme.subtext, fontSize: 10.5, fontWeight: '600' }}>{skin.starsRequired}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: {
    width: 42, height: 42, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 15, borderWidth: 1, marginBottom: 9,
  },
  chip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  skinCard: { width: 92, borderRadius: 16, padding: 8, gap: 6, alignItems: 'center' },
  skinPreview: {
    width: 68, height: 38, borderRadius: 12, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
});
