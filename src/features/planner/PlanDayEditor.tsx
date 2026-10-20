import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, AppState, Keyboard, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/FormField';
import { colors, fonts, text } from '@/constants/theme';
import { calculatePlan, connectionQuery, formatDate, formatTime, validatePlan, type PlanErrors, type PlanInput } from './plan';
import type { ConnectionQuery, TransitConnection } from '../transit/contract';
import { ConnectionPicker } from './ConnectionPicker';
import type { StoredPlan } from './useStoredPlan';
import { SavedPointPicker } from './SavedPointPicker';
import type { SavedPoint } from './settings';
import { useStoredSettings } from './StoredSettingsProvider';
import { validDayDetails } from './calendar';
import { RecurrenceFields } from './RecurrenceFields';

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
    ? 'Termin tego planu już minął. Wybierz inny dzień w kalendarzu.'
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

export function PlanDayEditor({ store, onClose }: { store: StoredPlan; onClose: () => void }) {
  const {
    day, plan, preferredDeparture, selectedDate, sourceDate, isSeries, hasEntry, updatePlan, updateDay, preferDeparture,
    loading, saving, saved, save, remove, storageError, migrationNotice,
  } = store;
  const { settings, loading: settingsLoading, storageError: settingsError } = useStoredSettings();
  const [now, setNow] = useState(() => Date.now());
  const result = validatePlan(plan);
  const startPoint = settings.startPoints.find((point) =>
    point.name === plan.origin && point.walkMinutes === plan.walkToMinutes && JSON.stringify(point.stop) === JSON.stringify(plan.fromStop));
  const endPoint = settings.endPoints.find((point) =>
    point.name === plan.destination && point.walkMinutes === plan.walkFromMinutes && JSON.stringify(point.stop) === JSON.stringify(plan.toStop));
  const queryInput = startPoint && endPoint ? connectionQuery(plan) : null;
  const queryKey = queryInput ? JSON.stringify(queryInput) : null;
  const query = useMemo<ConnectionQuery | null>(() => queryKey ? JSON.parse(queryKey) : null, [queryKey]);
  const [selection, setSelection] = useState<{ key: string; connection: TransitConnection } | null>(null);
  const selected = selection?.key === queryKey ? selection.connection : null;
  useEffect(() => { setSelection(null); }, [queryKey]);
  const errors: PlanErrors = result.ok ? {} : result.errors;
  const canSave = result.ok && !!selected && validDayDetails(day);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);

  function applyPoint(point: SavedPoint, start: boolean) {
    updatePlan(start ? 'origin' : 'destination', point.name);
    updatePlan(start ? 'fromStop' : 'toStop', point.stop);
    updatePlan(start ? 'walkToMinutes' : 'walkFromMinutes', point.walkMinutes);
    updatePlan('bufferMinutes', settings.bufferMinutes);
  }

  if (loading || settingsLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.loading}>
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
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving}
              onPress={() => { Keyboard.dismiss(); onClose(); }} style={styles.backButton}>
              <Text style={styles.backText}>‹ Wróć do kalendarza</Text>
            </Pressable>
            <Text style={text.label}>{selectedDate}</Text>
            <Text accessibilityRole="header" style={text.title}>{hasEntry ? 'Edytuj plan' : 'Dodaj plan'}</Text>
          </View>

          {query && selected && <DepartureCard plan={plan} now={now} connection={selected} />}

          <View style={styles.form} pointerEvents={saving ? 'none' : 'auto'}>
            <FormField label="Nazwa dnia (opcjonalnie)" value={day.name} maxLength={80} editable={!saving}
              placeholder="np. Zajęcia na uczelni" onChangeText={(name) => updateDay({ name })} />
            {isSeries && <Text style={text.body}>To plan cykliczny od {sourceDate}. Zmiany dotyczą całego cyklu.</Text>}
            <Text style={text.body}>Ustaw trasę i godzinę dotarcia.</Text>
            {settingsError && <Text accessibilityLiveRegion="polite" style={text.error}>{settingsError}</Text>}
            <SavedPointPicker label="Zapisane punkty początkowe" points={settings.startPoints} selectedId={startPoint?.id ?? null} onSelect={(point) => applyPoint(point, true)} />
            <SavedPointPicker label="Zapisane punkty końcowe" points={settings.endPoints} selectedId={endPoint?.id ?? null} onSelect={(point) => applyPoint(point, false)} />
            {startPoint && endPoint && <Text style={text.body}>Trasa: {plan.origin} → {plan.destination} · zapas {plan.bufferMinutes} min</Text>}
            {(!settings.startPoints.length || !settings.endPoints.length) &&
              <Text style={text.body}>Dodaj co najmniej jeden punkt początkowy i końcowy w zakładce „Ustawienia”, aby wyszukać trasę.</Text>}
            <FormField
              key={selectedDate} label="Godzina dotarcia w tym dniu" value={plan.time} maxLength={5} editable={!saving}
              placeholder="09:00" hint="Format 24-godzinny, HH:mm · czas polski" error={errors.time}
              autoCorrect={false} autoCapitalize="none" keyboardType="numbers-and-punctuation"
              onChangeText={(value) => updatePlan('time', value)}
            />
            <RecurrenceFields value={day.recurrence} disabled={saving} onChange={(recurrence) => updateDay({ recurrence })} />
            {isSeries && !day.recurrence && <Text style={text.body}>Wyłączenie powtarzania zastąpi cały cykl jednym planem na {selectedDate}.</Text>}
            {errors.date && <Text accessibilityLiveRegion="polite" style={text.error}>{errors.date}</Text>}
            {errors.time && <Text accessibilityLiveRegion="polite" style={text.error}>{errors.time}</Text>}
            {result.ok && result.arrival.getTime() <= now && <Text accessibilityLiveRegion="polite" style={text.error}>Termin tego planu już minął. Wybierz inny dzień lub zmień godzinę.</Text>}
            {migrationNotice && <Text accessibilityLiveRegion="polite" style={text.body}>{migrationNotice}</Text>}
            {query && queryKey && <ConnectionPicker key={queryKey} query={query} selected={selected} preferredDeparture={preferredDeparture}
              onSelect={(connection) => {
                setSelection(connection ? { key: queryKey, connection } : null);
                if (connection) preferDeparture(connection.departure);
              }} />}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave || saving, busy: saving }}
              disabled={!canSave || saving}
              onPress={() => {
                Keyboard.dismiss();
                void save(selected?.departure ?? null).then((success) => { if (success) onClose(); });
              }}
              style={({ pressed }) => [styles.button, (!canSave || saving || pressed) && styles.buttonMuted]}
            >
              <Text style={styles.buttonText}>{saving ? 'Zapisuję…' : day.recurrence ? 'Zapisz cykl' : 'Zapisz plan'}</Text>
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={storageError ? text.error : styles.saveStatus}>
              {storageError ?? (saved ? 'Plan zapisany na urządzeniu.'
                : !canSave ? 'Wybierz punkty, poprawną godzinę, połączenie i powtarzanie, aby zapisać plan.'
                  : 'Zmiany czekają na zapis.')}
            </Text>
            {hasEntry && <Pressable accessibilityRole="button" disabled={saving}
              accessibilityState={{ disabled: saving }} onPress={() => {
                Keyboard.dismiss();
                void remove().then((success) => { if (success) onClose(); });
              }} style={styles.removeButton}>
              <Text style={text.error}>{isSeries ? 'Usuń cały cykl' : 'Usuń plan tego dnia'}</Text>
            </Pressable>}
          </View>

          <Text style={styles.footer}>Dane rozkładowe: ZTP Kraków. Wyszukiwanie wymaga internetu.{`\n`}Po otwarciu dnia sprawdzamy zapisany kurs w aktualnym rozkładzie.</Text>
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
  backButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: colors.blue, fontSize: 15, fontWeight: '600' },
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
  removeButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  button: { borderRadius: 14, backgroundColor: colors.blue, minHeight: 54, padding: 16, alignItems: 'center', justifyContent: 'center' },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  saveStatus: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
});
