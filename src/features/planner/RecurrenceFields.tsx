import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/FormField';
import { colors, fonts, text } from '@/constants/theme';
import { validRecurrence, type Recurrence, type RecurrenceUnit } from './calendar';

const units: { unit: RecurrenceUnit | null; label: string; shortLabel: string; countLabel?: string }[] = [
  { unit: null, label: 'Brak', shortLabel: 'Jednorazowo' },
  { unit: 'day', label: 'Dni', shortLabel: 'Co X dni', countLabel: 'Powtarzaj co (liczba dni)' },
  { unit: 'week', label: 'Tygodnie', shortLabel: 'Co X tygodni', countLabel: 'Powtarzaj co (liczba tygodni)' },
  { unit: 'month', label: 'Miesiące', shortLabel: 'Co X miesięcy', countLabel: 'Powtarzaj co (liczba miesięcy)' },
  { unit: 'year', label: 'Lata', shortLabel: 'Co X lat', countLabel: 'Powtarzaj co (liczba lat)' },
];

export function formatRecurrenceSummary(value: Recurrence | null): string {
  if (!value) return 'Jednorazowo';
  const step = Number(value.interval) || 1;
  if (value.unit === 'day') return step === 1 ? 'Codziennie' : `Co ${step} dni`;
  if (value.unit === 'week') return step === 1 ? 'Co tydzień' : `Co ${step} tyg.`;
  if (value.unit === 'month') return step === 1 ? 'Co miesiąc' : `Co ${step} mies.`;
  return step === 1 ? 'Co rok' : `Co ${step} lat`;
}

export function RecurrenceFields({
  value,
  disabled,
  isSeries,
  selectedDate,
  onChange,
}: {
  value: Recurrence | null;
  disabled: boolean;
  isSeries?: boolean;
  selectedDate?: string;
  onChange: (value: Recurrence | null) => void;
}) {
  const valid = validRecurrence(value);
  const currentUnit = units.find(({ unit }) => unit === (value?.unit ?? null)) ?? units[0];

  return (
    <View style={styles.group}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>POWTARZAJ W CYKLU</Text>
        <Text style={styles.activeBadge}>{formatRecurrenceSummary(value)}</Text>
      </View>

      {/* Stitch Pill Selector mapped to real RecurrenceUnit */}
      <View accessibilityRole="radiogroup" style={styles.options}>
        {units.map(({ unit, label }) => {
          const selected = (value?.unit ?? null) === unit;
          return (
            <Pressable
              key={unit ?? 'none'}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(unit ? { unit, interval: value?.interval ?? '1' } : null)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.selected,
                (disabled || pressed) && styles.muted,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.selectedText]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isSeries && !value && selectedDate && (
        <Text style={styles.seriesDisableNotice}>
          Wyłączenie powtarzania zastąpi cały cykl pojedynczym planem w dniu {selectedDate}.
        </Text>
      )}

      {value && (
        <View style={styles.detailsBox}>
          <View style={styles.quickIntervalsRow}>
            {['1', '2', '3', '4'].map((step) => {
              const active = value.interval === step;
              return (
                <Pressable
                  key={step}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => onChange({ ...value, interval: step })}
                  style={[styles.intervalChip, active && styles.intervalChipActive]}
                >
                  <Text style={[styles.intervalChipText, active && styles.intervalChipTextActive]}>
                    Co {step}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <FormField
            label={currentUnit.countLabel ?? 'Odstęp powtarzania'}
            value={value.interval}
            maxLength={2}
            keyboardType="number-pad"
            editable={!disabled}
            hint="Powtarzaj co podaną liczbę jednostek (1–99)."
            error={valid ? undefined : 'Wpisz liczbę od 1 do 99.'}
            onChangeText={(interval) => onChange({ ...value, interval })}
          />
          {!valid && <Text accessibilityLiveRegion="polite" style={text.error}>Wpisz liczbę od 1 do 99.</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontFamily: fonts.clock,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
  },
  activeBadge: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  option: {
    flexGrow: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    fontFamily: fonts.clock,
    color: colors.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '600',
  },
  selectedText: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  seriesDisableNotice: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.secondary,
  },
  detailsBox: {
    gap: 8,
    paddingTop: 4,
  },
  quickIntervalsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  intervalChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalChipActive: {
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: colors.primary,
  },
  intervalChipText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  intervalChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  muted: {
    opacity: 0.65,
  },
});
