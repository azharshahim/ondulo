// ─── Code parental (définition / changement / suppression) ─────────────────
// Accessible uniquement depuis le tableau de bord parent, lui-même protégé
// par la porte parentale. Le code n'est jamais stocké en clair : seul son
// hachage salé est conservé (voir src/state/pin.ts).
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import { IconChevronLeft, IconLock } from '../ui/icons';
import { sound } from '../audio/sound';
import { clearPinHash, hasPin, setPin } from '../state/pin';

interface PinScreenProps {
  theme: Theme;
  t: Dict;
  onBack: () => void;
}

export default function PinScreen({ theme, t, onBack }: PinScreenProps) {
  const insets = useSafeAreaInsets();
  const [exists, setExists] = useState(false);
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void hasPin().then(setExists); }, []);

  const save = useCallback(async () => {
    if (busy) return;
    setErr(null); setMsg(null);
    if (!/^\d{4,6}$/.test(pin)) { setErr(t.pinMismatch); return; }
    if (pin !== confirm) { setErr(t.pinMismatch); return; }
    setBusy(true);
    const ok = await setPin(pin);
    setBusy(false);
    if (!ok) { setErr(t.pinMismatch); return; }
    sound.play('click');
    setExists(true);
    setPinValue(''); setConfirm('');
    setMsg(t.pinSet);
  }, [busy, pin, confirm, t]);

  const remove = useCallback(async () => {
    await clearPinHash();
    setExists(false);
    setMsg(t.pinReset);
  }, [t]);

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { sound.play('click'); onBack(); }}
          style={[styles.backBtn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
        >
          <IconChevronLeft size={20} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 21, fontWeight: '900', flex: 1 }}>{t.setPin}</Text>
        <IconLock size={20} color={theme.subtext} />
      </View>

      <View style={{ padding: 20 }}>
        <Text style={{ color: theme.subtext, fontSize: 13.5, lineHeight: 20, marginBottom: 14 }}>
          {exists ? t.pin : t.pin}
        </Text>

        <TextInput
          testID="pin-new"
          value={pin}
          onChangeText={(v) => { setPinValue(v.replace(/[^0-9]/g, '').slice(0, 6)); setErr(null); }}
          placeholder={t.pin}
          placeholderTextColor={theme.subtext}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          accessibilityLabel={t.pin}
          style={[styles.input, { color: theme.text, backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
        />
        <TextInput
          testID="pin-confirm"
          value={confirm}
          onChangeText={(v) => { setConfirm(v.replace(/[^0-9]/g, '').slice(0, 6)); setErr(null); }}
          placeholder={t.pinConfirm}
          placeholderTextColor={theme.subtext}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          accessibilityLabel={t.pinConfirm}
          style={[styles.input, { color: theme.text, backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
        />

        {err ? <Text testID="pin-error" style={{ color: '#E4572E', fontWeight: '800', marginTop: 10 }}>{err}</Text> : null}
        {msg ? <Text testID="pin-ok" style={{ color: theme.accent2, fontWeight: '800', marginTop: 10 }}>{msg}</Text> : null}

        <Pressable
          testID="pin-save"
          onPress={() => void save()}
          style={[styles.btn, { backgroundColor: theme.accent, borderColor: theme.panelBorder, marginTop: 18 }]}
        >
          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>{t.pinSet}</Text>
        </Pressable>

        {exists ? (
          <Pressable
            testID="pin-remove"
            onPress={() => void remove()}
            style={[styles.btn, { backgroundColor: theme.panel, borderColor: theme.panelBorder, marginTop: 10 }]}
          >
            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 15 }}>{t.pinReset}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  input: {
    borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16,
    fontSize: 18, fontWeight: '800', marginBottom: 10, letterSpacing: 4,
  },
  btn: { paddingVertical: 13, borderRadius: 999, borderWidth: 1, alignItems: 'center' },
});
