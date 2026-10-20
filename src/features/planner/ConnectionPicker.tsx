import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const [requested, setRequested] = useState(false);
  const load = useCallback((signal: AbortSignal) => getConnections(query, signal), [query]);
  const state = useTransitSearch(requested ? JSON.stringify(query) : null, load);
  const refresh = () => { onSelect(null); if (requested) state.retry(); else setRequested(true); };
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={text.heading}>Wybierz połączenie</Text>
      <Text style={text.body}>Rozkład ZTP Kraków · do 2 przesiadek. Godziny nie uwzględniają bieżących opóźnień. Przejścia między stanowiskami są szacowane.</Text>
      <Text style={text.body}>Przyjazd na przystanek najpóźniej {formatTime(new Date(query.arriveBy))} · {formatDate(new Date(query.arriveBy))}. Uwzględniliśmy dojście do celu i zapas.</Text>
      <Pressable accessibilityRole="button" disabled={state.status === 'loading'}
        accessibilityState={{ disabled: state.status === 'loading', busy: state.status === 'loading' }}
        onPress={refresh} style={styles.searchButton}>
        <Text style={text.label}>{requested ? 'Odśwież połączenia' : 'Wyszukaj połączenia'}</Text>
      </Pressable>
      {state.status === 'loading' && <ActivityIndicator color={colors.blue} accessibilityLabel="Wyszukiwanie połączeń" />}
      {state.error && <RetryMessage error={state.error} retry={refresh} />}
      {state.status === 'success' && state.items.length === 0 && (
        <Text accessibilityLiveRegion="polite" style={text.body}>Brak połączeń z maksymalnie dwiema przesiadkami, które pozwalają dotrzeć na czas z tych stanowisk. Zmień termin lub przystanki albo ponów wyszukiwanie.</Text>
      )}
      {state.items.map((connection) => {
        const checked = selected?.id === connection.id;
        return (
          <Pressable key={connection.id} accessibilityRole="radio" accessibilityState={{ checked }}
            onPress={() => onSelect(connection)} style={[styles.connection, checked && styles.selected]}>
            <Text style={text.label}>{checked ? '✓ Wybrane · ' : ''}{formatTime(new Date(connection.departure))} → {formatTime(new Date(connection.arrival))}</Text>
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
      {state.status === 'success' && state.items.length > 0 && !selected && <Text accessibilityLiveRegion="polite" style={text.body}>Wybierz połączenie, aby obliczyć godzinę wyjścia.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  searchButton: { padding: 14, minHeight: 48, borderRadius: 12, backgroundColor: colors.background },
  connection: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: colors.background, borderRadius: 12, gap: 6 },
  selected: { borderColor: colors.blue, backgroundColor: colors.background },
});
