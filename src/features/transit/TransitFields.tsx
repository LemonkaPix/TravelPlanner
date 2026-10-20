import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/FormField';
import { colors, text } from '@/constants/theme';
import { searchStops } from './krakowApi';
import type { TransitStop } from './contract';
import { useTransitSearch } from './useTransitSearch';

export function RetryMessage({ error, retry }: { error: string; retry: () => void }) {
  return (
    <View style={styles.group}>
      <Text accessibilityLiveRegion="polite" style={text.error}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.option}>
        <Text style={text.label}>Spróbuj ponownie</Text>
      </Pressable>
    </View>
  );
}

function Selection({ label, detail, clear, error }: { label: string; detail: string; clear: () => void; error?: string }) {
  return (
    <View style={styles.selection}>
      <Text style={text.label}>{label}</Text>
      <Text style={text.body}>{detail}</Text>
      {error && <Text accessibilityLiveRegion="polite" style={text.error}>{error}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Zmień: ${label}`} onPress={clear} style={styles.option}>
        <Text style={text.label}>Zmień wybór</Text>
      </Pressable>
    </View>
  );
}

export function StopPicker({ label, cityId, value, onChange, error }: {
  label: string; cityId: string | null; value: TransitStop | null;
  onChange: (value: TransitStop | null) => void; error?: string;
}) {
  const [query, setQuery] = useState('');
  const normalized = query.trim();
  const key = !value && cityId && normalized.length >= 2 ? JSON.stringify([cityId, normalized]) : null;
  const load = useCallback((signal: AbortSignal) => cityId ? searchStops(cityId, normalized, signal) : Promise.resolve([]), [cityId, normalized]);
  const state = useTransitSearch(key, load, 350);
  if (value) return <Selection label={label} error={error} detail={`${value.label} · ${value.code ?? 'lokalizacja przystanku'}`} clear={() => { setQuery(''); onChange(null); }} />;
  return (
    <View style={styles.group}>
      <FormField label={label} value={query} onChangeText={setQuery} editable={Boolean(cityId)}
        placeholder="np. Teatr Bagatela" maxLength={120} error={error}
        hint="Wpisz co najmniej 2 znaki nazwy lub kodu. Wybierz konkretne stanowisko z listy." />
      {state.status === 'loading' && <ActivityIndicator color={colors.blue} accessibilityLabel={`Wyszukiwanie: ${label}`} />}
      {state.error && <RetryMessage error={state.error} retry={state.retry} />}
      {state.status === 'success' && state.items.length === 0 && <Text accessibilityLiveRegion="polite" style={text.body}>Brak przystanków dla tej nazwy. Wpisz inną nazwę.</Text>}
      {state.items.map((stop) => (
        <Pressable key={stop.id} accessibilityRole="button" onPress={() => onChange(stop)} style={styles.option}>
          <Text style={text.label}>{stop.label}</Text><Text style={text.body}>{stop.code ? `Kod: ${stop.code}` : 'Lokalizacja przystanku'}</Text>
        </Pressable>
      ))}
      {state.status === 'success' && state.items.length === 0 && <Pressable accessibilityRole="button" onPress={state.retry} style={styles.option}><Text style={text.label}>Ponów wyszukiwanie przystanków</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  selection: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.blue },
  option: { minHeight: 46, justifyContent: 'center', padding: 12, borderRadius: 10, backgroundColor: colors.background },
});
