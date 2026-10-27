import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/FormField';
import { colors, text } from '@/constants/theme';
import { createManualLeg, type ManualLeg } from './journey';
import type { PlanInput } from './plan';

export function ManualConnectionFields({ plan, disabled, error, onChange }: {
  plan: PlanInput;
  disabled: boolean;
  error?: string;
  onChange: (legs: ManualLeg[]) => void;
}) {
  const { legs } = plan;
  function change(next: ManualLeg[]) {
    onChange(next.map((leg, index) => ({ ...leg,
      from: index === 0 ? plan.fromStop?.label ?? '' : leg.from,
      to: index === next.length - 1 ? plan.toStop?.label ?? '' : leg.to,
    })));
  }
  function update(index: number, patch: Partial<ManualLeg>) {
    change(legs.map((leg, current) => {
      if (current === index) return { ...leg, ...patch };
      if (current === index + 1 && patch.to !== undefined) return { ...leg, from: patch.to };
      if (current === index - 1 && patch.from !== undefined) return { ...leg, to: patch.from };
      return leg;
    }));
  }
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={text.heading}>Połączenie ręczne</Text>
      <Text style={text.body}>Wpisz godziny dla każdego odcinka. Przy podróży przez północ zmień datę odjazdu lub przyjazdu. Wszystkie godziny są w czasie polskim.</Text>
      {legs.map((leg, index) => (
        <View key={index} style={styles.leg}>
          <Text style={text.label}>Odcinek {index + 1}</Text>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: leg.walking, disabled: disabled || (!leg.walking && (index === 0 || index === legs.length - 1)) }} disabled={disabled || (!leg.walking && (index === 0 || index === legs.length - 1))}
            onPress={() => update(index, { walking: !leg.walking, label: !leg.walking ? 'Przejście piesze' : '' })} style={styles.button}>
            <Text style={styles.buttonText}>{leg.walking ? 'Pieszo między przystankami' : 'Przejazd'}{leg.walking || (index > 0 && index < legs.length - 1) ? ' · zmień rodzaj' : ''}</Text>
          </Pressable>
          <FormField label={leg.walking ? 'Opis przejścia' : 'Linia / nazwa połączenia'} value={leg.label} maxLength={240} editable={!disabled}
            placeholder={leg.walking ? 'np. Przejście na drugi peron' : 'np. 194, tramwaj 18, pociąg'} onChangeText={(label) => update(index, { label })} />
          <FormField label="Z przystanku" value={leg.from} maxLength={240} editable={!disabled && index !== 0}
            hint={index === 0 ? 'Przystanek początkowy z parametrów trasy.' : undefined} onChangeText={(from) => update(index, { from })} />
          <FormField label="Do przystanku" value={leg.to} maxLength={240} editable={!disabled && index !== legs.length - 1}
            hint={index === legs.length - 1 ? 'Przystanek końcowy z parametrów trasy.' : undefined} onChangeText={(to) => update(index, { to })} />
          <FormField label="Data odjazdu (DD.MM.RRRR)" value={leg.departureDate} maxLength={10} editable={!disabled}
            keyboardType="numbers-and-punctuation" onChangeText={(departureDate) => update(index, { departureDate })} />
          <FormField label={leg.walking ? 'Początek przejścia (GG:MM)' : 'Odjazd (GG:MM)'} value={leg.departureTime} maxLength={5} editable={!disabled}
            keyboardType="numbers-and-punctuation" placeholder="08:00" onChangeText={(departureTime) => update(index, { departureTime })} />
          <FormField label="Data przyjazdu (DD.MM.RRRR)" value={leg.arrivalDate} maxLength={10} editable={!disabled}
            keyboardType="numbers-and-punctuation" onChangeText={(arrivalDate) => update(index, { arrivalDate })} />
          <FormField label={leg.walking ? 'Koniec przejścia (GG:MM)' : 'Przyjazd (GG:MM)'} value={leg.arrivalTime} maxLength={5} editable={!disabled}
            keyboardType="numbers-and-punctuation" placeholder="08:30" onChangeText={(arrivalTime) => update(index, { arrivalTime })} />
          <Pressable accessibilityRole="button" disabled={disabled} onPress={() => change(legs.filter((_, current) => current !== index))} style={styles.button}>
            <Text style={text.error}>Usuń odcinek {index + 1}</Text>
          </Pressable>
        </View>
      ))}
      {error && <Text accessibilityLiveRegion="polite" style={text.error}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={disabled || legs.length >= 20} style={[styles.button, (disabled || legs.length >= 20) && styles.muted]}
        onPress={() => {
          const previous = legs.at(-1);
          const date = previous?.arrivalDate ?? plan.date;
          change([...legs, createManualLeg(date, previous?.to ?? plan.fromStop?.label, plan.toStop?.label)]);
        }}>
        <Text style={styles.buttonText}>{legs.length ? 'Dodaj kolejny odcinek / przesiadkę' : 'Dodaj połączenie'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 20, backgroundColor: colors.surfaceContainerLow, gap: 16 },
  leg: { padding: 14, borderRadius: 14, backgroundColor: colors.surfaceContainer, gap: 12 },
  button: { minHeight: 44, padding: 12, borderRadius: 10, backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center' },
  buttonText: { color: colors.primary, fontWeight: '600' },
  muted: { opacity: 0.5 },
});
