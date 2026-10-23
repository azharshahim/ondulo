// ─── Tableau de bord parent ────────────────────────────────────────────────
// Temps de jeu jour/semaine, niveaux terminés, étoiles, limite quotidienne,
// plage de coucher, rappel de pause, interrupteurs, PIN et conf.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type ParentalSettings, type ProfilesData,
} from '../state/storage';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import {
  IconChevronLeft, IconCheck, IconLock, IconSparkle, IconStar,
} from '../ui/icons';
import { sound } from '../audio/sound';

interface ParentalDashboardProps {
  theme: Theme;
  t: Dict;
  data: ProfilesData;
  settings: ParentalSettings;
  onChange: (patch: Partial<ParentalSettings>) => void;
  onSetPin: () => void;
  onPrivacy: () => void;
  onBack: () => void;
}

export default function ParentalDashboard({
  theme, t, data, settings, onChange, onSetPin, onPrivacy, onBack,
}: ParentalDashboardProps) {
  const insets = useSafeAreaInsets();
  const click = (fn: () => void) => () => { sound.play('click'); fn(); };

  const totalStars = data.profiles.reduce(
    (sum, p) => sum + Object.values(p.stars).reduce((a, b) => a + b, 0), 0);
  const totalPlayTime = data.profiles.reduce((sum, p) => sum + p.playTimeMin, 0);
  const levelsDone = data.profiles.reduce((sum, p) => sum + p.levelsDone, 0);

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable onPress={click(onBack)} style={[styles.backBtn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
          <IconChevronLeft size={20} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 21, fontWeight: '900', flex: 1 }}>{t.parentalDashboard}</Text>
        <IconLock size={20} color={theme.subtext} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        {/* Statistiques */}
        <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <IconSparkle size={22} color={theme.accent2} />
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700' }}>{t.totalPlayTime}</Text>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 17 }}>{fmt(totalPlayTime)}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <IconStar size={22} color={theme.accent} />
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700' }}>{t.totalStars}</Text>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 17 }}>{totalStars}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <IconCheck size={22} color={theme.accent2} />
            <Text style={{ color: theme.subtext, fontSize: 11, fontWeight: '700' }}>{t.levelsDone}</Text>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 17 }}>{levelsDone}</Text>
          </View>
        </View>

        <Section title={t.limits} theme={theme}>
          <Text style={{ color: theme.subtext, fontSize: 12.5, marginBottom: 6 }}>{t.dailyLimit}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[0, 15, 30, 45, 60].map((m) => (
              <Chip key={m} label={m === 0 ? t.noLimit : `${m} ${t.minutes}`}
                selected={settings.dailyLimitMin === m}
                onPress={() => onChange({ dailyLimitMin: m })} theme={theme} />
            ))}
          </View>
          <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 10, marginBottom: 6 }}>{t.bedtime}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label={`${settings.bedtimeStartMin / 60}h`} selected={true} onPress={() => onChange({ bedtimeStartMin: 20 * 60 })} theme={theme} />
            <Chip label={`${settings.bedtimeEndMin / 60}h`} selected={true} onPress={() => onChange({ bedtimeEndMin: 7 * 60 })} theme={theme} />
          </View>
          <Text style={{ color: theme.subtext, fontSize: 12.5, marginTop: 10, marginBottom: 6 }}>{t.pauseReminder}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[15, 20, 30, 45].map((m) => (
              <Chip key={m} label={`${m} ${t.minutes}`} selected={settings.pauseReminderMin === m}
                onPress={() => onChange({ pauseReminderMin: m })} theme={theme} />
            ))}
          </View>
        </Section>

        <Section title={t.switches} theme={theme}>
          {[
            { key: 'soundOn', label: t.sound },
            { key: 'hapticsOn', label: t.haptics },
            { key: 'hintsOn', label: t.hint },
            { key: 'notificationsOn', label: t.notifications },
          ].map((sw) => (
            <View key={sw.key} style={[styles.row, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{sw.label}</Text>
              <Switch
                value={settings[sw.key as keyof ParentalSettings] as boolean}
                onValueChange={(v) => onChange({ [sw.key]: v } as Partial<ParentalSettings>)}
                trackColor={{ true: theme.accent2, false: 'rgba(130,130,160,0.4)' }}
                thumbColor="#FFF"
              />
            </View>
          ))}
        </Section>

        <Section title={t.security} theme={theme}>
          <Pressable onPress={click(onSetPin)}
            style={[styles.row, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
            <IconLock size={20} color={theme.text} />
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{t.setPin}</Text>
            <IconChevronLeft size={18} color={theme.subtext} />
          </Pressable>
          <Pressable onPress={click(onPrivacy)}
            style={[styles.row, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
            <IconSparkle size={20} color={theme.accent} />
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{t.privacy}</Text>
            <IconChevronLeft size={18} color={theme.subtext} />
          </Pressable>
        </Section>
      </ScrollView>
    </View>
  );
}

function fmt(min: number): string {
  if (min < 60) return `${min} ${''}`;
  return `${Math.floor(min / 60)}h ${min % 60}`;
}

function Section({ title, theme, children }: { title: string; theme: Theme; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: theme.subtext, fontWeight: '800', fontSize: 12.5, letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Chip({ label, selected, onPress, theme }: { label: string; selected: boolean; onPress: () => void; theme: Theme }) {
  return (
    <Pressable onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.panel, borderColor: selected ? theme.accent : theme.panelBorder }]}>
      <Text style={{ color: selected ? '#FFF' : theme.text, fontWeight: '800', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 15, borderWidth: 1, marginBottom: 9 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
});
