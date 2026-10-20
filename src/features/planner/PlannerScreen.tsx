import { useEffect, useState } from 'react';
import {
  ActivityIndicator, AppState, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/FormField';
import { colors, fonts, text } from '@/constants/theme';
import { calculatePlan, formatDate, formatTime, type PlanErrors, type PlanInput } from './plan';
import { useStoredPlan } from './useStoredPlan';

function TimelineStop({ label, date, detail }: { label: string; date: Date; detail: string }) {
  return (
    <View style={styles.stop}>
      <View style={styles.dot} />
      <View style={styles.stopContent}>
        <View style={styles.stopHeading}>
          <Text style={[text.label, styles.stopLabel]}>{label}</Text>
          <Text style={styles.stopTime}>{formatTime(date)}</Text>
        </View>
        <Text style={text.body}>{detail} · {formatDate(date)}</Text>
      </View>
    </View>
  );
}

function DepartureCard({ plan, now }: { plan: PlanInput; now: number }) {
  const result = calculatePlan(plan);
  if (!result.ok) {
    return (
      <View style={styles.emptyCard}>
        <Text style={text.heading}>O której wyjść?</Text>
        <Text style={text.body}>Uzupełnij plan poniżej. Obliczymy godzinę wyjścia z domu.</Text>
      </View>
    );
  }
  const minutesLeft = Math.ceil((result.departure.getTime() - now) / 60_000);
  const notice = result.arrival.getTime() <= now
    ? 'Termin tych zajęć już minął. Wybierz nową datę lub godzinę.'
    : result.departure.getTime() < now
      ? 'Godzina wyjścia już minęła. Wyjście teraz nie zapewni zaplanowanego zapasu.'
      : `Dojazd ${result.travelMinutes} min + zapas ${result.bufferMinutes} min`;

  return (
    <View style={styles.ticket}>
      <View style={styles.departure}>
        <Text style={styles.ticketLabel}>WYJDŹ Z DOMU O</Text>
        <Text
          accessibilityLabel={`Godzina wyjścia: ${formatTime(result.departure)}`}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={styles.departureTime}
        >
          {formatTime(result.departure)}
        </Text>
        <Text style={styles.ticketDate}>{formatDate(result.departure)}</Text>
        {minutesLeft > 0 && minutesLeft <= 120 && (
          <Text style={styles.countdown}>Do wyjścia: {minutesLeft} min</Text>
        )}
      </View>
      <View style={styles.timeline}>
        <TimelineStop label={plan.origin.trim()} date={result.departure} detail="Wyjście" />
        <TimelineStop label={plan.destination.trim()} date={result.campusArrival} detail="Na miejscu" />
        <TimelineStop label="Początek zajęć" date={result.arrival} detail="Termin zajęć" />
        <Text style={[text.body, result.departure.getTime() < now && text.error]}>{notice}</Text>
      </View>
    </View>
  );
}

export default function PlannerScreen() {
  const { plan, updatePlan, loading, saving, saved, save, storageError } = useStoredPlan();
  const [now, setNow] = useState(() => Date.now());
  const result = calculatePlan(plan);
  const errors: PlanErrors = result.ok ? {} : result.errors;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.blue} accessibilityLabel="Wczytywanie planu" />
        <Text style={text.body}>Wczytuję Twój plan…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.brand}>TravelPlanner <Text style={styles.brandArrow}>↗</Text></Text>
            <Text accessibilityRole="header" style={text.title}>Na uczelnię.{`\n`}Bez pośpiechu.</Text>
            <Text style={text.body}>Zaplanuj drogę. Zostaw sobie chwilę zapasu.</Text>
          </View>

          <DepartureCard plan={plan} now={now} />

          <View style={styles.form}>
            <Text accessibilityRole="header" style={text.heading}>Twój plan</Text>
            <FormField
              label="Skąd wychodzisz?" value={plan.origin} maxLength={120}
              placeholder="np. Dom na Mokotowie" error={errors.origin}
              onChangeText={(value) => updatePlan('origin', value)}
            />
            <FormField
              label="Gdzie masz zajęcia?" value={plan.destination} maxLength={120}
              placeholder="np. Wydział Architektury, sala 12" error={errors.destination}
              onChangeText={(value) => updatePlan('destination', value)}
            />
            <View style={styles.row}>
              <View style={styles.column}>
                <FormField
                  label="Data zajęć" value={plan.date} maxLength={10}
                  placeholder="DD.MM.RRRR" hint="DD.MM.RRRR" error={errors.date}
                  autoCorrect={false} autoCapitalize="none" keyboardType="numbers-and-punctuation"
                  onChangeText={(value) => updatePlan('date', value)}
                />
              </View>
              <View style={styles.column}>
                <FormField
                  label="Godzina zajęć" value={plan.time} maxLength={5}
                  placeholder="09:00" hint="Format 24-godzinny, HH:mm" error={errors.time}
                  autoCorrect={false} autoCapitalize="none" keyboardType="numbers-and-punctuation"
                  onChangeText={(value) => updatePlan('time', value)}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.column}>
                <FormField
                  label="Dojazd (min)" value={plan.travelMinutes} maxLength={3}
                  keyboardType="number-pad" error={errors.travelMinutes}
                  onChangeText={(value) => updatePlan('travelMinutes', value)}
                />
              </View>
              <View style={styles.column}>
                <FormField
                  label="Zapas (min)" value={plan.bufferMinutes} maxLength={3}
                  keyboardType="number-pad" error={errors.bufferMinutes}
                  onChangeText={(value) => updatePlan('bufferMinutes', value)}
                />
              </View>
            </View>
            <Text style={text.body}>Wlicz w dojazd dojście na przystanek, czekanie i drogę do sali. Zapas to dodatkowy czas przed zajęciami.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !result.ok || saving, busy: saving }}
              disabled={!result.ok || saving}
              onPress={() => { void save(); }}
              style={({ pressed }) => [styles.button, (!result.ok || saving || pressed) && styles.buttonMuted]}
            >
              <Text style={styles.buttonText}>{saving ? 'Zapisuję…' : 'Zapisz plan'}</Text>
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={storageError ? text.error : styles.saveStatus}>
              {storageError ?? (!result.ok ? 'Uzupełnij poprawnie pola, aby zapisać plan.'
                : saved ? 'Plan zapisany na tym urządzeniu.' : 'Zmiany czekają na zapis.')}
            </Text>
          </View>

          <Text style={styles.footer}>Czas dojazdu podajesz samodzielnie.{`\n`}Obliczenia działają offline, według czasu telefonu.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 24 },
  header: { gap: 14, paddingTop: 12 },
  brand: { color: colors.ink, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  brandArrow: { color: colors.blue, fontSize: 22 },
  ticket: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.white },
  departure: { backgroundColor: colors.blue, padding: 24, alignItems: 'center', gap: 6 },
  ticketLabel: { color: colors.white, fontSize: 12, letterSpacing: 2, fontWeight: '600' },
  departureTime: { color: colors.white, fontFamily: fonts.clock, fontSize: 64, fontWeight: '600', fontVariant: ['tabular-nums'] },
  ticketDate: { color: colors.white, fontSize: 16 },
  countdown: { color: colors.white, fontSize: 13, marginTop: 6 },
  timeline: { padding: 22, gap: 18 },
  stop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue, marginTop: 5 },
  stopContent: { flex: 1, gap: 4 },
  stopHeading: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' },
  stopLabel: { flexShrink: 1 },
  stopTime: { color: colors.ink, fontFamily: fonts.clock, fontSize: 14, fontWeight: '600' },
  emptyCard: { padding: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted, borderRadius: 22, gap: 10 },
  form: { padding: 22, backgroundColor: colors.white, borderRadius: 22, gap: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  column: { flexGrow: 1, flexBasis: 130, minWidth: 130 },
  button: { borderRadius: 14, backgroundColor: colors.blue, minHeight: 54, padding: 16, alignItems: 'center', justifyContent: 'center' },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  saveStatus: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
});
