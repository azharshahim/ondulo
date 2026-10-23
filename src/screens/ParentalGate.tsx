// ─── Porte parentale ───────────────────────────────────────────────────────
// Barrière OBLIGATOIRE avant tout écran réservé aux adultes (tableau de bord
// parent, confidentialité, définition du code parental, prolongation de
// temps) : code parental à 4-6 chiffres s'il existe, sinon question de
// calcul. Aucun accès n'est possible sans franchir cette porte ; en cas
// d'échec répété, le verrouillage progressif s'applique.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Dict } from '../i18n';
import type { Theme } from '../ui/theme';
import { IconLock, IconChevronLeft } from '../ui/icons';
import { sound } from '../audio/sound';
import { checkPin, hasPin } from '../state/pin';

interface ParentalGateProps {
  theme: Theme;
  t: Dict;
  /** Raison de la porte (affichée : accès parents, prolongation…). */
  reason?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/** Question de calcul tirée au hasard (barrière parentale). */
function makeChallenge(): { question: string; answer: number } {
  const a = 3 + Math.floor(Math.random() * 8);   // 3..10
  const b = 6 + Math.floor(Math.random() * 8);   // 6..13
  const c = 2 + Math.floor(Math.random() * 8);   // 2..9
  const product = a * c + b;
  return { question: `${a} × ${c} + ${b}`, answer: product };
}

export default function ParentalGate({
  theme, t, reason, onSuccess, onCancel,
}: ParentalGateProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'loading' | 'pin' | 'challenge'>('loading');
  const [pin, setPinValue] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [challenge, setChallenge] = useState(() => makeChallenge());
  // La dérivation du PIN (scrypt, ~1 s) est volontairement coûteuse : on
  // affiche un indicateur pour que l'attente soit lisible.
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    void hasPin().then((has) => { if (alive) setMode(has ? 'pin' : 'challenge'); });
    return () => { alive = false; };
  }, []);

  // Compte à rebours du verrouillage progressif.
  useEffect(() => {
    if (!lockedUntil) return;
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, [lockedUntil]);

  const locked = lockedUntil > now;
  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  const submitPin = useCallback(async () => {
    if (pin.length < 4 || locked || checking) return;
    setChecking(true);
    setError(null);
    const res = await checkPin(pin);
    setChecking(false);
    if (res.ok) {
      sound.play('click');
      onSuccess();
      return;
    }
    sound.play('error');
    setPinValue('');
    if (res.locked) {
      setLockedUntil(res.lockedUntil);
      setError(t.gateLocked);
    } else {
      setError(res.failsLeft > 0 ? `${t.gateWrong} (${res.failsLeft})` : t.gateWrong);
    }
  }, [pin, locked, checking, onSuccess, t]);

  const submitAnswer = useCallback(() => {
    if (locked) return;
    if (String(answer).trim() === String(challenge.answer)) {
      sound.play('click');
      onSuccess();
      return;
    }
    sound.play('error');
    setAnswer('');
    setError(t.gateWrong);
    setChallenge(makeChallenge());
  }, [answer, challenge.answer, locked, onSuccess, t]);

  const title = useMemo(() => reason ?? t.gateTitle, [reason, t.gateTitle]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, backgroundColor: theme.isDark ? 'rgba(6,10,28,0.98)' : 'rgba(247,250,255,0.99)' }]}>
      <View style={styles.header}>
        <Pressable
          testID="gate-cancel"
          onPress={() => { sound.play('click'); onCancel(); }}
          style={[styles.backBtn, { backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
        >
          <IconChevronLeft size={20} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: 21, fontWeight: '900', flex: 1 }}>{title}</Text>
        <IconLock size={20} color={theme.subtext} />
      </View>

      <View style={styles.card}>
        <IconLock size={34} color={theme.accent} />
        <Text style={{ color: theme.subtext, fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 19 }}>
          {t.gateText}
        </Text>

        {mode === 'loading' ? null : mode === 'pin' ? (
          <>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800', marginTop: 18 }}>{t.gatePinPrompt}</Text>
            <TextInput
              testID="gate-pin"
              value={pin}
              onChangeText={(v) => { setPinValue(v.replace(/[^0-9]/g, '').slice(0, 6)); setError(null); }}
              onSubmitEditing={() => void submitPin()}
              placeholder="••••"
              placeholderTextColor={theme.subtext}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              editable={!locked && !checking}
              autoFocus
              accessibilityLabel={t.gatePinPrompt}
              style={[styles.input, { color: theme.text, backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
            />
            <Pressable
              testID="gate-submit-pin"
              disabled={locked || pin.length < 4 || checking}
              onPress={() => void submitPin()}
              style={[styles.btn, { backgroundColor: locked || pin.length < 4 || checking ? theme.panel : theme.accent, borderColor: theme.panelBorder }]}
            >
              {checking
                ? <ActivityIndicator color={theme.accent} />
                : <Text style={{ color: locked || pin.length < 4 ? theme.subtext : '#FFF', fontWeight: '900', fontSize: 16 }}>{t.ok}</Text>}
            </Pressable>
            <Text testID="gate-busy" style={{ color: theme.subtext, fontSize: 12, marginTop: 8, opacity: checking ? 1 : 0 }}>…</Text>
          </>
        ) : (
          <>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800', marginTop: 18 }}>{t.gateMath}</Text>
            <Text testID="gate-challenge" style={{ color: theme.accentText, fontSize: 30, fontWeight: '900', marginTop: 6, letterSpacing: 2 }}>
              {challenge.question}
            </Text>
            <TextInput
              testID="gate-answer"
              value={answer}
              onChangeText={(v) => { setAnswer(v.replace(/[^0-9]/g, '').slice(0, 4)); setError(null); }}
              onSubmitEditing={submitAnswer}
              placeholder={t.gateAnswer}
              placeholderTextColor={theme.subtext}
              keyboardType="number-pad"
              editable={!locked}
              accessibilityLabel={t.gateAnswer}
              style={[styles.input, { color: theme.text, backgroundColor: theme.panel, borderColor: theme.panelBorder }]}
            />
            <Pressable
              testID="gate-submit-answer"
              disabled={locked || answer.length === 0}
              onPress={submitAnswer}
              style={[styles.btn, { backgroundColor: locked || answer.length === 0 ? theme.panel : theme.accent, borderColor: theme.panelBorder }]}
            >
              <Text style={{ color: locked || answer.length === 0 ? theme.subtext : '#FFF', fontWeight: '900', fontSize: 16 }}>{t.ok}</Text>
            </Pressable>
          </>
        )}

        {error ? (
          <Text testID="gate-error" style={{ color: theme.error, fontWeight: '800', fontSize: 13.5, marginTop: 12, textAlign: 'center' }}>
            {locked ? `${error} ${secondsLeft}s` : error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 60 },
  input: {
    minWidth: 170, textAlign: 'center', fontSize: 24, fontWeight: '900', letterSpacing: 8,
    borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18, marginTop: 14,
  },
  btn: {
    marginTop: 16, paddingVertical: 13, paddingHorizontal: 40, borderRadius: 999,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', minWidth: 170,
  },
});
