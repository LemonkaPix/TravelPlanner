import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, AppState, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/FormField';
import { colors, fonts, text } from '@/constants/theme';
import { calculatePlan, connectionQuery, formatDate, formatTime, validatePlan, type PlanErrors, type PlanInput } from './plan';
import type { ConnectionQuery, TransitConnection } from '../transit/contract';
import { transitConfigured } from '../transit/krakowApi';
import { StopPicker } from '../transit/TransitFields';
import { ConnectionPicker } from './ConnectionPicker';
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

function DepartureCard({ plan, now, connection }: { plan: PlanInput; now: number; connection: TransitConnection | null }) {
  const result = calculatePlan(plan, connection);
  if (!result.ok) {
    return (
      <View style={styles.emptyCard}>
        <Text style={text.heading}>O której wyjść?</Text>
        <Text style={text.body}>{'message' in result ? result.message : 'Uzupełnij plan poniżej i wybierz połączenie. Obliczymy godzinę wyjścia z domu.'}</Text>
      </View>
    );
  }
  const minutesLeft = Math.ceil((result.departure.getTime() - now) / 60_000);
  const notice = result.arrival.getTime() <= now
    ? 'Termin tych zajęć już minął. Wybierz nową datę lub godzinę.'
    : result.departure.getTime() < now
      ? 'Godzina wyjścia już minęła. Wyszukaj nowe połączenie lub zmień termin.'
      : `Dojście do przystanku: ${plan.walkToMinutes} min · od przystanku: ${plan.walkFromMinutes} min · zapas: ${plan.bufferMinutes} min`;

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
        <TimelineStop label={plan.fromStop!.label} date={result.stopDeparture} detail="Po dojściu na przystanek" />
        <TimelineStop label={plan.fromStop!.label} date={result.stopDeparture} detail="Odjazd wybranego połączenia" />
        <TimelineStop label={plan.toStop!.label} date={result.stopArrival} detail="Przyjazd na przystanek końcowy" />
        <TimelineStop label={plan.destination.trim()} date={result.destinationArrival} detail="Po dojściu do celu" />
        <TimelineStop label="Planowany termin" date={result.arrival} detail="Początek zajęć" />
        <Text style={[text.body, result.departure.getTime() < now && text.error]}>{notice}</Text>
      </View>
    </View>
  );
}

export default function PlannerScreen() {
  const { plan, updatePlan, loading, saving, saved, save, storageError, migrationNotice } = useStoredPlan();
  const [now, setNow] = useState(() => Date.now());
  const result = validatePlan(plan);
  const queryInput = connectionQuery(plan);
  const queryKey = queryInput ? JSON.stringify(queryInput) : null;
  const query = useMemo<ConnectionQuery | null>(() => queryKey ? JSON.parse(queryKey) : null, [queryKey]);
  const [selection, setSelection] = useState<{ key: string; connection: TransitConnection } | null>(null);
  const selected = selection?.key === queryKey ? selection.connection : null;
  useEffect(() => { setSelection(null); }, [queryKey]);
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

          <DepartureCard plan={plan} now={now} connection={selected} />

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
            <Text style={text.body}>Datę i godzinę podaj dla dotarcia do miejsca docelowego. Obowiązuje czas polski (Europe/Warsaw).</Text>
            {result.ok && result.arrival.getTime() <= now && <Text accessibilityLiveRegion="polite" style={text.error}>Termin tego planu już minął. Zmień datę lub godzinę.</Text>}
            {migrationNotice && <Text accessibilityLiveRegion="polite" style={text.body}>{migrationNotice}</Text>}
            {!transitConfigured && <Text accessibilityLiveRegion="polite" style={text.error}>Wyszukiwanie połączeń nie jest jeszcze dostępne. Usługa wymaga konfiguracji.</Text>}
            <View style={styles.city}><Text style={text.label}>Obszar komunikacji</Text><Text style={text.body}>Kraków i okolice · autobusy i tramwaje KMK</Text></View>
            <StopPicker key={`from:${plan.city?.id ?? ''}`} label="Przystanek początkowy" cityId={plan.city?.id ?? null}
              value={plan.fromStop} error={errors.fromStop} onChange={(value) => updatePlan('fromStop', value)} />
            <StopPicker key={`to:${plan.city?.id ?? ''}`} label="Przystanek końcowy" cityId={plan.city?.id ?? null}
              value={plan.toStop} error={errors.toStop} onChange={(value) => updatePlan('toStop', value)} />
            <FormField label="Dojście do przystanku (min)" value={plan.walkToMinutes} maxLength={3}
              keyboardType="number-pad" error={errors.walkToMinutes} onChangeText={(value) => updatePlan('walkToMinutes', value)} />
            <FormField label="Dojście od przystanku do celu (min)" value={plan.walkFromMinutes} maxLength={3}
              keyboardType="number-pad" error={errors.walkFromMinutes} onChangeText={(value) => updatePlan('walkFromMinutes', value)} />
            <View style={styles.row}>
              <View style={styles.column}>
                <FormField
                  label="Zapas (min)" value={plan.bufferMinutes} maxLength={3}
                  keyboardType="number-pad" error={errors.bufferMinutes}
                  onChangeText={(value) => updatePlan('bufferMinutes', value)}
                />
              </View>
            </View>
            <Text style={text.body}>Zapas to dodatkowy czas przed zajęciami. Każdy czas dojścia może wynosić od 0 do 180 minut.</Text>
            {query && queryKey && <ConnectionPicker key={queryKey} query={query} selected={selected}
              onSelect={(connection) => setSelection(connection ? { key: queryKey, connection } : null)} />}
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
                : saved ? 'Konfiguracja zapisana na tym urządzeniu.' : 'Zmiany konfiguracji czekają na zapis.')}
            </Text>
          </View>

          <Text style={styles.footer}>Dane rozkładowe: ZTP Kraków. Wyszukiwanie wymaga internetu.{`\n`}Zapisujemy konfigurację; po otwarciu wyszukaj aktualny rozkład.</Text>
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
  city: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  column: { flexGrow: 1, flexBasis: 130, minWidth: 130 },
  button: { borderRadius: 14, backgroundColor: colors.blue, minHeight: 54, padding: 16, alignItems: 'center', justifyContent: 'center' },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  saveStatus: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
});
