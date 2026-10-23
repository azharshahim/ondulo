// ─── Écran Confidentialité ─────────────────────────────────────────────────
// Modèle à faire valider juridiquement : rien ne quitte l'appareil.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import { IconChevronLeft, IconSparkle } from '../ui/icons';
import { sound } from '../audio/sound';

export default function PrivacyScreen({ theme, t, onBack }: {
  theme: Theme;
  t: Dict;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable onPress={() => { sound.play('click'); onBack(); }}
          style={[styles.backBtn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
          <IconChevronLeft size={20} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 21, fontWeight: '900', flex: 1 }}>{t.privacy}</Text>
        <IconSparkle size={20} color={theme.accent2} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        <View style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '900' }}>{t.privacyTitle}</Text>
          <Text style={{ color: theme.subtext, fontSize: 13.5, lineHeight: 20, marginTop: 8 }}>{t.privacyBody}</Text>
          <View style={{ marginTop: 12, gap: 6 }}>
            {[
              t.privacyNoExternalLinks,
              t.privacyNoAds,
              t.privacyNoAnalytics,
              t.privacyNoAccount,
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: theme.accentText, fontWeight: '900' }}>✓</Text>
                <Text style={{ color: theme.text, fontSize: 14 }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={{ color: theme.subtext, fontSize: 11.5, textAlign: 'center', marginTop: 12, lineHeight: 16 }}>
          {t.privacyModel}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 18, borderRadius: 20, borderWidth: 1 },
});
