import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/FormField';
import { colors, text } from '@/constants/theme';
import { validRecurrence, type Recurrence, type RecurrenceUnit } from './calendar';

const units: { unit: RecurrenceUnit | null; label: string; countLabel?: string }[] = [
  { unit: null, label: 'Nie powtarzaj' },
  { unit: 'day', label: 'Dni', countLabel: 'Liczba dni' },
  { unit: 'week', label: 'Tygodnie', countLabel: 'Liczba tygodni' },
  { unit: 'month', label: 'Miesiące', countLabel: 'Liczba miesięcy' },
  { unit: 'year', label: 'Lata', countLabel: 'Liczba lat' },
];

export function RecurrenceFields({ value, disabled, onChange }: {
  value: Recurrence | null; disabled: boolean; onChange: (value: Recurrence | null) => void;
}) {
  const valid = validRecurrence(value);
  return (
    <View style={styles.group}>
      <Text style={text.label}>Powtarzanie</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {units.map(({ unit, label }) => {
          const selected = (value?.unit ?? null) === unit;
          return (
            <Pressable key={unit ?? 'none'} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }}
              disabled={disabled} onPress={() => onChange(unit ? { unit, interval: value?.interval ?? '1' } : null)}
              style={({ pressed }) => [styles.option, selected && styles.selected, (disabled || pressed) && styles.muted]}>
              <Text style={[styles.optionText, selected && styles.selectedText]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {value && <>
        <FormField label={units.find(({ unit }) => unit === value.unit)?.countLabel ?? 'Odstęp'}
          value={value.interval} maxLength={2} keyboardType="number-pad" editable={!disabled}
          hint="Powtarzaj co podaną liczbę. Wpisz od 1 do 99." error={valid ? undefined : 'Wpisz liczbę od 1 do 99.'}
          onChangeText={(interval) => onChange({ ...value, interval })} />
        {!valid && <Text accessibilityLiveRegion="polite" style={text.error}>Wpisz liczbę od 1 do 99.</Text>}
        <Text style={text.body}>
          {value.unit === 'day' ? 'Plan powtarza się co wskazaną liczbę dni.'
            : value.unit === 'week' ? 'Plan powtarza się w ten sam dzień tygodnia.'
              : value.unit === 'year' ? 'Plan powtarza się w ten sam dzień i miesiąc roku. Lata bez tego dnia są pomijane.'
                : 'Plan powtarza się w ten sam dzień miesiąca. Miesiące bez tego dnia są pomijane.'}
          {' '}Godzina dotarcia pozostaje taka sama w czasie polskim. Każde wystąpienie sprawdzamy w aktualnym rozkładzie.
        </Text>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.background, justifyContent: 'center' },
  selected: { backgroundColor: colors.blue },
  optionText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  selectedText: { color: colors.white },
  muted: { opacity: 0.55 },
});
