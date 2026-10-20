import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, text } from '@/constants/theme';
import type { ConnectionQuery } from '../transit/contract';
import { getConnections } from '../transit/krakowApi';
import { RetryMessage } from '../transit/TransitFields';
import { useTransitSearch } from '../transit/useTransitSearch';
import { nextCalendarEntry, type CalendarDays } from './calendar';
import { calculatePlan, connectionQuery, formatDate, formatTime } from './plan';
import { useStoredSettings } from './StoredSettingsProvider';

export function UpcomingPlanPanel({ days, now, refreshVersion, onOpen }: {
  days: CalendarDays; now: number; refreshVersion: number; onOpen: (date: string) => void;
}) {
  const entry = useMemo(() => nextCalendarEntry(days, now), [days, now]);
  const day = entry?.day;
  const plan = day?.plan;
  const { settings, loading: settingsLoading } = useStoredSettings();
  const currentPoints = !!plan && settings.startPoints.some((point) =>
    point.name === plan.origin && point.walkMinutes === plan.walkToMinutes && JSON.stringify(point.stop) === JSON.stringify(plan.fromStop)) &&
    settings.endPoints.some((point) =>
      point.name === plan.destination && point.walkMinutes === plan.walkFromMinutes && JSON.stringify(point.stop) === JSON.stringify(plan.toStop));
  const queryInput = plan && currentPoints && !settingsLoading ? connectionQuery(plan) : null;
  const queryKey = queryInput ? JSON.stringify(queryInput) : null;
  const query = useMemo<ConnectionQuery | null>(() => queryKey ? JSON.parse(queryKey) : null, [queryKey]);
  const load = useCallback((signal: AbortSignal) => query ? getConnections(query, signal) : Promise.resolve([]), [query]);
  const state = useTransitSearch(queryKey ? JSON.stringify([queryKey, refreshVersion]) : null, load);
  const connection = state.status === 'success' && day
    ? day.preferredDeparture
      ? state.items.find((item) => item.departure === day.preferredDeparture) ?? null
      : state.items[0] ?? null
    : null;
  const result = plan ? calculatePlan(plan, connection) : null;
  const rides = connection?.legs.filter((leg) => !leg.walking) ?? [];
  const departurePassed = result?.ok && result.departure.getTime() < now;

  if (!day || !plan) {
    return (
      <View style={styles.card}>
        <Text accessibilityRole="header" style={text.heading}>Najbliższy przejazd</Text>
        <Text style={text.body}>Nie masz nadchodzącego planu. Wybierz dzień w kalendarzu i zapisz przejazd.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.eyebrow}>NAJBLIŻSZY PRZEJAZD</Text>
        <Text style={styles.date}>{plan.date === formatDate(new Date(now)) ? 'Dzisiaj' : plan.date}</Text>
      </View>
      {day.name !== '' && <Text accessibilityRole="header" style={styles.name}>{day.name}</Text>}
      <View style={styles.departure}>
        <View style={styles.departureHeading}>
          <Text style={styles.departureLabel}>Wyjdź z: {plan.origin}</Text>
          <Text accessibilityLabel={result?.ok ? `Godzina wyjścia: ${formatTime(result.departure)}` : 'Godzina wyjścia jest sprawdzana'}
            adjustsFontSizeToFit numberOfLines={1} style={styles.departureTime}>{result?.ok ? formatTime(result.departure) : '—'}</Text>
          {result?.ok && formatDate(result.departure) !== plan.date && <Text style={styles.departureLabel}>{formatDate(result.departure)}</Text>}
        </View>
        <View style={styles.destination}>
          <Text style={text.label}>Cel podróży</Text>
          <Text style={styles.destinationName}>{plan.destination}</Text>
          <Text style={text.body}>Na godzinę <Text style={styles.targetTime}>{plan.time}</Text></Text>
        </View>
      </View>
      {(settingsLoading || state.status === 'loading') && <View style={styles.loading}>
        <ActivityIndicator color={colors.blue} accessibilityLabel="Sprawdzanie rozkładu najbliższego przejazdu" />
        <Text style={text.body}>Sprawdzam rozkład…</Text>
      </View>}
      {!settingsLoading && !currentPoints && <Text accessibilityLiveRegion="polite" style={text.error}>Punkty tego planu zmieniły się w ustawieniach. Otwórz plan i wybierz je ponownie.</Text>}
      {state.error && <RetryMessage error={state.error} retry={state.retry} />}
      {state.status === 'success' && !connection && <Text accessibilityLiveRegion="polite" style={text.error}>
        {day.preferredDeparture ? 'Zapisany kurs nie jest dostępny w aktualnych propozycjach. Otwórz plan i wybierz inne połączenie.'
          : 'Brak połączeń na ten termin. Otwórz plan i zmień godzinę lub trasę.'}
      </Text>}
      {connection && result?.ok && <View style={styles.rides}>
        {rides.map((leg, index) => <View key={`${leg.departure}-${index}`} style={styles.ride}>
          <View style={styles.rideTimeColumn}>
            <Text style={styles.rideCaption}>{index === 0 ? 'Odjazd' : 'Przesiadka'}</Text>
            <Text style={styles.rideTime}>{formatTime(new Date(leg.departure))}</Text>
            {formatDate(new Date(leg.departure)) !== plan.date && <Text style={styles.rideCaption}>{formatDate(new Date(leg.departure))}</Text>}
          </View>
          <View style={styles.rideInfo}>
            <Text style={styles.line}>Linia {leg.label}</Text>
            <Text style={styles.stop}>{leg.from}</Text>
          </View>
        </View>)}
        <Text style={styles.note}>Na miejscu ok. {formatTime(result.destinationArrival)}{formatDate(result.destinationArrival) !== plan.date ? ` (${formatDate(result.destinationArrival)})` : ''} · dojście {plan.walkToMinutes} min · zapas {plan.bufferMinutes} min</Text>
        {departurePassed && <Text accessibilityLiveRegion="polite" style={text.error}>Godzina wyjścia już minęła. Otwórz plan, aby zmienić połączenie.</Text>}
        <Text style={styles.note}>Rozkład ZTP · bez bieżących opóźnień.</Text>
      </View>}
      {connection && result && !result.ok && <Text style={text.error}>Nie można obliczyć godziny wyjścia. Otwórz plan i wybierz połączenie ponownie.</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Otwórz plan na ${plan.date}`}
        onPress={() => onOpen(plan.date)} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}>
        <Text style={styles.openText}>Otwórz plan →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, backgroundColor: colors.white, borderRadius: 22, gap: 14 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrow: { color: colors.blue, fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  date: { color: colors.muted, fontSize: 13 },
  name: { color: colors.ink, fontSize: 19, fontWeight: '600' },
  departure: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18 },
  departureHeading: { flexGrow: 1, flexBasis: 150, backgroundColor: colors.blue, padding: 16, borderRadius: 14, gap: 4 },
  departureLabel: { color: colors.white, fontSize: 12, lineHeight: 18 },
  departureTime: { color: colors.white, fontFamily: fonts.clock, fontSize: 44, fontWeight: '600', fontVariant: ['tabular-nums'] },
  destination: { flexGrow: 1, flexBasis: 130, gap: 6 },
  destinationName: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  targetTime: { color: colors.ink, fontWeight: '600', fontVariant: ['tabular-nums'] },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rides: { gap: 10 },
  ride: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  rideTimeColumn: { minWidth: 62, gap: 3 },
  rideCaption: { color: colors.muted, fontSize: 11 },
  rideTime: { color: colors.ink, fontFamily: fonts.clock, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rideInfo: { flex: 1, gap: 4 },
  line: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  stop: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  openButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  openText: { color: colors.blue, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
