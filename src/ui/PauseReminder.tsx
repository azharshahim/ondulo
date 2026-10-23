// ─── Rappel de pause ───────────────────────────────────────────────────────
// Affiché après X minutes de jeu (réglage parental) : propose de faire une
// pause ou de continuer. Ne bloque jamais la partie.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import { sound } from '../audio/sound';

export default function PauseReminder({ theme, t, minutes, onPause, onContinue }: {
  theme: Theme;
  t: Dict;
  minutes: number;
  onPause: () => void;
  onContinue: () => void;
}) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View
        testID="pause-reminder"
        style={[styles.card, { backgroundColor: theme.isDark ? '#1C1C38' : '#FFFFFF', borderColor: theme.panelBorder }]}
      >
        <Text style={[styles.title, { color: theme.text }]}>{t.pauseReminder}</Text>
        <Text style={{ color: theme.subtext, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>
          {`${minutes} ${t.minutes}`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Pressable
            testID="pause-break"
            onPress={() => { sound.play('click'); onPause(); }}
            style={[styles.btn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
          >
            <Text style={{ color: theme.text, fontWeight: '800' }}>{t.takeBreak}</Text>
          </Pressable>
          <Pressable
            testID="pause-continue"
            onPress={() => { sound.play('click'); onContinue(); }}
            style={[styles.btn, { backgroundColor: theme.accent, borderColor: theme.panelBorder }]}
          >
            <Text style={{ color: '#FFF', fontWeight: '900' }}>{t.resume}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'flex-end', padding: 16,
  },
  card: {
    width: '100%', borderRadius: 20, borderWidth: 1, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: { fontSize: 17, fontWeight: '900' },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center' },
});
