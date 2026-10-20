import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, text } from '@/constants/theme';
import type { ConnectionQuery, TransitConnection } from '../transit/contract';
import { getConnections } from '../transit/krakowApi';
import { RetryMessage } from '../transit/TransitFields';
import { useTransitSearch } from '../transit/useTransitSearch';
import { formatDate, formatTime } from './plan';

export function ConnectionPicker({ query, selected, preferredDeparture, onSelect }: {
  query: ConnectionQuery; selected: TransitConnection | null;
  preferredDeparture: string | null;
  onSelect: (connection: TransitConnection | null) => void;
}) {
  const load = useCallback((signal: AbortSignal) => getConnections(query, signal), [query]);
  const state = useTransitSearch(JSON.stringify(query), load);
  useEffect(() => {
    if (state.status === 'success' && state.items.length > 0 && !selected) {
      const preferred = state.items.find((connection) => connection.departure === preferredDeparture);
      if (preferred) onSelect(preferred);
      else if (preferredDeparture === null) onSelect(state.items[0]);
    }
  }, [state.status, state.items, selected, preferredDeparture, onSelect]);
  const preferredUnavailable = preferredDeparture !== null && state.status === 'success' &&
    !state.items.some((connection) => connection.departure === preferredDeparture);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={text.heading}>Połączenie na ten dzień</Text>
      <Text style={text.body}>Wybierz kurs, który chcesz widzieć w planie. Domyślnie proponujemy najpóźniejszy odjazd, który pozwala zdążyć.</Text>
      <Text style={text.body}>Rozkład ZTP Kraków · do 2 przesiadek. Godziny nie uwzględniają bieżących opóźnień. Przejścia między stanowiskami są szacowane.</Text>
      <Text style={text.body}>Przyjazd na przystanek najpóźniej {formatTime(new Date(query.arriveBy))} · {formatDate(new Date(query.arriveBy))}. Uwzględniliśmy dojście do celu i zapas.</Text>
      {state.status === 'loading' && <ActivityIndicator color={colors.blue} accessibilityLabel="Wyszukiwanie połączeń" />}
      {state.error && <RetryMessage error={state.error} retry={() => { onSelect(null); state.retry(); }} />}
      {preferredUnavailable && <Text accessibilityLiveRegion="polite" style={text.error}>Zapisany kurs nie jest już dostępny w propozycjach. Wybierz inny i zapisz dzień ponownie.</Text>}
      {state.status === 'success' && state.items.length === 0 && (
        <Text accessibilityLiveRegion="polite" style={text.body}>Brak połączeń z maksymalnie dwiema przesiadkami, które pozwalają dotrzeć na czas z tych stanowisk. Zmień termin albo punkty i spróbuj ponownie.</Text>
      )}
      {state.items.map((connection) => {
        const isSelected = selected?.id === connection.id;
        return (
          <Pressable key={connection.id} accessibilityRole="radio" accessibilityState={{ checked: isSelected }}
            accessibilityLabel={`Odjazd ${formatTime(new Date(connection.departure))}, przyjazd ${formatTime(new Date(connection.arrival))}`}
            onPress={() => onSelect(connection)} style={({ pressed }) => [styles.connection, isSelected && styles.selected, pressed && styles.pressed]}>
            <Text style={text.label}>{isSelected ? '✓ Wybrane · ' : ''}{formatTime(new Date(connection.departure))} → {formatTime(new Date(connection.arrival))}</Text>
            <Text style={text.body}>{formatDate(new Date(connection.departure))} → {formatDate(new Date(connection.arrival))}</Text>
            <Text style={text.body}>Rozkład pobrany: {formatDate(new Date(connection.scheduleUpdatedAt))} · {formatTime(new Date(connection.scheduleUpdatedAt))}</Text>
            {connection.legs.map((leg, index) => (
              <Text key={index} style={text.body}>
                {leg.label}: {leg.from} → {leg.to}{'\n'}
                {formatTime(new Date(leg.departure))}–{formatTime(new Date(leg.arrival))}
              </Text>
            ))}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  connection: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: colors.background, borderRadius: 12, gap: 6 },
  selected: { borderColor: colors.blue, backgroundColor: colors.background },
  pressed: { opacity: 0.6 },
});
