// ─── Sélection / création de profil ────────────────────────────────────────
// Écran du premier lancement (ou bouton « Profils » de l'accueil) : liste des
// profils existants, création d'un nouveau profil (nom, avatar serpent,
// tranche d'âge), et choix de l'enfant/adulte.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AGE_GROUPS, type AgeGroup, type ProfilesData, type Profile,
} from '../state/storage';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import { IconChevronLeft, IconLock, IconSnake, IconStar } from '../ui/icons';
import { sound } from '../audio/sound';

interface ProfileScreenProps {
  theme: Theme;
  t: Dict;
  data: ProfilesData;
  onPick: (id: string) => void;
  onCreate: (p: Profile) => void;
  onBack: () => void;
}

const AVATAR_COLORS = ['#EF6B73', '#F2D94E', '#9BDD4A', '#0A9BEF', '#C9A0F5', '#E89BDD', '#F0B63F', '#A86A55'];

export default function ProfileScreen({ theme, t, data, onPick, onCreate, onBack }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(0);
  const [age, setAge] = useState<AgeGroup>('6-9');

  const click = (fn: () => void) => () => { sound.play('click'); fn(); };

  const create = () => {
    if (!name.trim()) return;
    onCreate({
      id: `p${Date.now()}`,
      name: name.trim(),
      avatarColor: AVATAR_COLORS[avatar],
      ageGroup: age,
      stars: {},
      unlocked: 1,
      daily: {},
      skins: ['classique'],
      playTimeMin: 0,
      levelsDone: 0,
      lastPlayed: Date.now(),
      isChild: age === '3-5' || age === '6-9',
    });
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable onPress={click(onBack)} style={[styles.backBtn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
          <IconChevronLeft size={20} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 21, fontWeight: '900', flex: 1 }}>{t.profiles}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        {/* Profils existants */}
        {data.profiles.length === 0 ? (
          <Text style={{ color: theme.subtext, textAlign: 'center', marginBottom: 12 }}>{t.noProfiles}</Text>
        ) : (
          <View style={{ gap: 10, marginBottom: 20 }}>
            {data.profiles.map((p) => (
              <Pressable key={p.id} onPress={click(() => onPick(p.id))}
                style={[styles.profileCard, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}>
                <View style={[styles.avatar, { backgroundColor: p.avatarColor }]}>
                  <IconSnake size={26} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>{p.name}</Text>
                  <Text style={{ color: theme.subtext, fontSize: 12.5 }}>
                    {t.stars} {Object.values(p.stars).reduce((a, b) => a + b, 0)} • {t.levels} {p.unlocked - 1}
                  </Text>
                </View>
                <Text style={{ color: theme.subtext, fontSize: 18 }}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Création */}
        <Section title={t.newProfile} theme={theme}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t.profileNamePlaceholder}
            placeholderTextColor={theme.subtext}
            style={[styles.input, { backgroundColor: theme.panel, borderColor: theme.panelBorder, color: theme.text }]}
            maxLength={16}
          />
          <Text style={{ color: theme.subtext, fontSize: 12.5, fontWeight: '600', marginBottom: 6 }}>{t.avatar}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {AVATAR_COLORS.map((c, i) => (
              <Pressable key={i} onPress={() => setAvatar(i)}
                style={[styles.avatarSel, { backgroundColor: c, borderColor: avatar === i ? theme.accent2 : 'transparent' }]}>
                {avatar === i && <Text style={{ color: '#FFF', fontWeight: '900' }}>✓</Text>}
              </Pressable>
            ))}
          </View>
          <Text style={{ color: theme.subtext, fontSize: 12.5, fontWeight: '600', marginTop: 10, marginBottom: 6 }}>{t.ageGroup}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {AGE_GROUPS.map((g) => (
              <Pressable key={g.id} onPress={() => setAge(g.id)}
                style={[styles.chip, { backgroundColor: age === g.id ? theme.accent : theme.panel, borderColor: age === g.id ? theme.accent : theme.panelBorder }]}>
                <Text style={{ color: age === g.id ? '#FFF' : theme.text, fontWeight: '800', fontSize: 13 }}>{g.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={click(create)} disabled={!name.trim()}
            style={[styles.btn, { backgroundColor: theme.accent, borderColor: theme.panelBorder, opacity: name.trim() ? 1 : 0.5 }]}>
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>{t.createProfile}</Text>
          </Pressable>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, theme, children }: { title: string; theme: Theme; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: theme.subtext, fontWeight: '800', fontSize: 12.5, letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>{title.toUpperCase()}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  backBtn: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarSel: { width: 38, height: 38, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  input: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  btn: { paddingVertical: 13, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
