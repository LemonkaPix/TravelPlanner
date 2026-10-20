import { useCallback, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, text } from '@/constants/theme';
import type { ConnectionQuery, TransitConnection } from '../transit/contract';
import { getConnections } from '../transit/krakowApi';
import { RetryMessage } from '../transit/TransitFields';
import { useTransitSearch } from '../transit/useTransitSearch';
import { formatDate, formatTime } from './plan';

export function ConnectionPicker({ query, selected, onSelect }: {
  query: ConnectionQuery; selected: TransitConnection | null;
  onSelect: (connection: TransitConnection | null) => void;
}) {
  const load = useCallback((signal: AbortSignal) => getConnections(query, signal), [query]);
  const state = useTransitSearch(JSON.stringify(query), load);
  useEffect(() => {
    if (state.status === 'success' && state.items.length > 0 && !selected) onSelect(state.items[0]);
  }, [state.status, state.items, selected, onSelect]);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={text.heading}>Najlepsze połączenie</Text>
      <Text style={text.body}>Automatycznie wybraliśmy wariant z najpóźniejszym odjazdem, który zdąży na czas.</Text>
      <Text style={text.body}>Rozkład ZTP Kraków · do 2 przesiadek. Godziny nie uwzględniają bieżących opóźnień. Przejścia między stanowiskami są szacowane.</Text>
      <Text style={text.body}>Przyjazd na przystanek najpóźniej {formatTime(new Date(query.arriveBy))} · {formatDate(new Date(query.arriveBy))}. Uwzględniliśmy dojście do celu i zapas.</Text>
      {state.status === 'loading' && <ActivityIndicator color={colors.blue} accessibilityLabel="Wyszukiwanie połączeń" />}
      {state.error && <RetryMessage error={state.error} retry={state.retry} />}
      {state.status === 'success' && state.items.length === 0 && (
        <Text accessibilityLiveRegion="polite" style={text.body}>Brak połączeń z maksymalnie dwiema przesiadkami, które pozwalają dotrzeć na czas z tych stanowisk. Zmień termin albo punkty i spróbuj ponownie.</Text>
      )}
      {state.items.slice(0, 1).map((connection) => {
        const isSelected = selected?.id === connection.id;
        return (
          <View key={connection.id} style={styles.connection}>
            <Text style={text.label}>{isSelected ? '✓ Wybrane automatycznie · ' : ''}{formatTime(new Date(connection.departure))} → {formatTime(new Date(connection.arrival))}</Text>
            <Text style={text.body}>{formatDate(new Date(connection.departure))} → {formatDate(new Date(connection.arrival))}</Text>
            <Text style={text.body}>Rozkład pobrany: {formatDate(new Date(connection.scheduleUpdatedAt))} · {formatTime(new Date(connection.scheduleUpdatedAt))}</Text>
            {connection.legs.map((leg, index) => (
              <Text key={index} style={text.body}>
                {leg.label}: {leg.from} → {leg.to}{'\n'}
                {formatTime(new Date(leg.departure))}–{formatTime(new Date(leg.arrival))}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  connection: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: colors.blue, backgroundColor: colors.background, borderRadius: 12, gap: 6 },
});
