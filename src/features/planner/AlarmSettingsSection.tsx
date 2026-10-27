import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { FormField } from '@/components/FormField';
import { colors, fonts, text } from '@/constants/theme';
import { alarmTimes, validateAlarmPreferences, type AlarmPreferences } from './alarms';
import { parseDateTime } from './dateTime';
import { formatDate, formatTime } from './plan';
import { useStoredSettings } from './StoredSettingsProvider';

export function AlarmSettingsSection() {
  const { settings, saving, saveSettings } = useStoredSettings();
  const [draft, setDraft] = useState(settings.alarm);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const errors = validateAlarmPreferences(draft);
  const valid = Object.keys(errors).length === 0;
  const unchanged = JSON.stringify(draft) === JSON.stringify(settings.alarm);
  const exampleDeparture = parseDateTime('15.06.2030', '08:00')!;
  const example = valid ? alarmTimes(exampleDeparture, draft) : [];

  useEffect(() => { setDraft(settings.alarm); }, [settings.alarm]);

  function update(patch: Partial<AlarmPreferences>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setNotice(null);
  }

  async function save() {
    if (!valid || saving) return;
    Keyboard.dismiss();
    setNotice(null);
    const success = await saveSettings({ ...settings, alarm: draft });
    setFailed(!success);
    setNotice(success ? 'Zapisano ustawienia budzika.' : 'Nie udało się zapisać ustawień budzika. Spróbuj ponownie.');
  }

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <MaterialIcons name="alarm" size={22} color={colors.primary} />
        <Text accessibilityRole="header" style={styles.title}>Budzik przed wyjściem</Text>
      </View>
      <Text style={text.body}>
        Ostatni budzik dzwoni tyle minut przed wyjściem, ile potrzebujesz na przygotowanie. Włączysz go przy planie wybranego dnia.
      </Text>
      <FormField
        label="Czas na przygotowanie (min)"
        value={draft.preparationMinutes}
        onChangeText={(preparationMinutes) => update({ preparationMinutes })}
        keyboardType="number-pad"
        maxLength={3}
        editable={!saving}
        hint="Od 1 do 720 minut, licząc od wstania z łóżka do wyjścia."
        error={errors.preparationMinutes}
      />
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={styles.switchTitle}>Seria dla śpiochów</Text>
          <Text style={text.body}>Wcześniejsze budziki przed właściwą pobudką.</Text>
        </View>
        <Switch
          accessibilityLabel="Seria budzików dla śpiochów"
          value={draft.seriesEnabled}
          onValueChange={(seriesEnabled) => update({ seriesEnabled })}
          disabled={saving}
          trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
          thumbColor={colors.onSurface}
        />
      </View>
      {draft.seriesEnabled && (
        <>
          <FormField
            label="Liczba budzików w serii"
            value={draft.count}
            onChangeText={(count) => update({ count })}
            keyboardType="number-pad"
            maxLength={2}
            editable={!saving}
            hint="Od 2 do 10, łącznie z ostatnim budzikiem."
            error={errors.count}
          />
          <FormField
            label="Odstęp między budzikami (min)"
            value={draft.intervalMinutes}
            onChangeText={(intervalMinutes) => update({ intervalMinutes })}
            keyboardType="number-pad"
            maxLength={3}
            editable={!saving}
            hint="Od 1 do 180 minut. Dodajemy wcześniejsze budziki; czas na przygotowanie pozostaje pełny."
            error={errors.intervalMinutes}
          />
        </>
      )}
      {valid && (
        <View style={styles.example}>
          <Text style={styles.exampleTitle}>Przykład · wyjście o 08:00</Text>
          <View style={styles.times}>
            {example.map(({ date, label }) => (
              <View key={date.getTime()} style={styles.timeItem}>
                <Text style={styles.time}>{formatTime(date)}</Text>
                <Text style={text.body}>{label}</Text>
                {formatDate(date) !== '15.06.2030' && <Text style={text.body}>{formatDate(date)}</Text>}
              </View>
            ))}
          </View>
          <Text style={text.body}>{draft.preparationMinutes} min na przygotowanie → wyjście 08:00</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid || unchanged || saving }}
        disabled={!valid || unchanged || saving}
        onPress={() => { void save(); }}
        style={({ pressed }) => [styles.saveButton, (!valid || unchanged || saving || pressed) && styles.muted]}
      >
        <Text style={styles.saveText}>{saving ? 'Zapisuję…' : 'Zapisz ustawienia budzika'}</Text>
      </Pressable>
      {notice && <Text accessibilityLiveRegion="polite" style={failed ? text.error : text.body}>{notice}</Text>}
      <Text style={text.body}>
        Dodane budziki obsługuje systemowy Zegar. Zmiana ustawień lub planu nie zmienia już dodanych budzików — popraw je w Zegarze.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 14, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchCopy: { flex: 1, gap: 4 },
  switchTitle: { fontSize: 16, fontWeight: '600', color: colors.onSurface },
  example: { padding: 12, borderRadius: 10, gap: 10, backgroundColor: colors.surfaceContainer },
  exampleTitle: { fontSize: 13, fontWeight: '600', color: colors.primary },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  timeItem: { gap: 2 },
  time: { fontFamily: fonts.clock, fontSize: 21, fontWeight: '700', color: colors.onSurface, fontVariant: ['tabular-nums'] },
  saveButton: { minHeight: 46, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', padding: 12 },
  saveText: { fontSize: 14, fontWeight: '700', color: colors.onPrimary, textAlign: 'center' },
  muted: { opacity: 0.5 },
});
