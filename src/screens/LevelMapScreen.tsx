// ─── Carte des niveaux : grille 1→60 avec étoiles et verrous ───────────────
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOTAL_LEVELS } from '../levels/levels';
import type { Progress } from '../state/storage';
import type { Dict } from '../state/i18n';
import type { Theme } from '../ui/theme';
import { sound } from '../audio/sound';

interface LevelMapScreenProps {
  theme: Theme;
  t: Dict;
  progress: Progress;
  dailyDone: boolean;
  onSelect: (n: number) => void;
  onDaily: () => void;
  onBack: () => void;
}

export default function LevelMapScreen({
  theme, t, progress, dailyDone, onSelect, onDaily, onBack,
}: LevelMapScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { sound.play('click'); onBack(); }}
          style={[styles.backBtn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>‹</Text>
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 21, fontWeight: '900', flex: 1 }}>{t.levels}</Text>
        <Text style={{ color: theme.subtext, fontWeight: '700' }}>⭐ {
          Object.values(progress.stars).reduce((a, b) => a + b, 0)
        }</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        {/* Défi quotidien */}
        <Pressable
          onPress={() => { sound.play('click'); onDaily(); }}
          style={[styles.dailyCard, { backgroundColor: theme.panel, borderColor: theme.accent }]}
        >
          <Text style={{ fontSize: 27 }}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16.5 }}>{t.daily}</Text>
            <Text style={{ color: theme.subtext, fontSize: 12.5, fontWeight: '600' }}>
              {dailyDone ? t.dailyDone : 'Un nouveau niveau chaque jour !'}
            </Text>
          </View>
          <Text style={{ fontSize: 20 }}>{dailyDone ? '✅' : '›'}</Text>
        </Pressable>

        {/* Grille des niveaux */}
        <View style={styles.grid}>
          {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((n) => {
            const locked = n > progress.unlocked;
            const stars = progress.stars[String(n)] ?? 0;
            return (
              <Pressable
                key={n}
                disabled={locked}
                onPress={() => { sound.play('click'); onSelect(n); }}
                style={({ pressed }) => [
                  styles.levelBtn,
                  {
                    backgroundColor: locked
                      ? 'rgba(120,120,150,0.15)'
                      : stars > 0 ? theme.accent2 : theme.panel,
                    borderColor: theme.panelBorder,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={{
                  color: locked ? theme.subtext : '#FFF',
                  fontWeight: '900', fontSize: 16.5,
                  textShadowColor: 'rgba(0,0,0,0.2)', textShadowRadius: 2,
                }}>
                  {locked ? '🔒' : n}
                </Text>
                {!locked && (
                  <Text style={{ fontSize: 9.5, letterSpacing: 1, color: '#FFC93C', marginTop: 1 }}>
                    {'★'.repeat(stars)}
                    <Text style={{ color: 'rgba(255,255,255,0.4)' }}>{'★'.repeat(3 - stars)}</Text>
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
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
  dailyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 15, borderRadius: 19, borderWidth: 1.5, marginBottom: 16,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  levelBtn: {
    width: 58, height: 58, borderRadius: 17, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
