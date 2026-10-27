import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, text } from '@/constants/theme';
import { calculateDayAlarms, systemAlarmDateIssue } from './alarms';
import type { CalendarDay } from './calendar';
import { formatDate, formatTime } from './plan';
import { useStoredSettings } from './StoredSettingsProvider';
import { openSystemAlarms, sendSystemAlarms, systemAlarmCreationIssue, systemAlarmSupported } from './systemAlarms';

export function DayAlarmPanel({ day, now, disabled = false }: { day: CalendarDay; now: number; disabled?: boolean }) {
  const { settings, loading, saving } = useStoredSettings();
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [notice, setNotice] = useState<{ message: string; failed: boolean } | null>(null);
  const result = calculateDayAlarms(day.plan, settings.alarm);
  const signature = JSON.stringify([day.plan, day.name, settings.alarm]);
  const issue = result.ok ? systemAlarmDateIssue(result.alarms, now) : result.message;
  const departureAlarm = result.ok ? [{ date: result.departure, label: 'Godzina wyjścia' }] : [];
  const departureIssue = result.ok ? systemAlarmDateIssue(departureAlarm, now) : result.message;
  const blocked = loading || saving || disabled || busy;
  const cannotSet = blocked || !!systemAlarmCreationIssue || !!issue;

  useEffect(() => { setNotice(null); }, [signature]);

  async function handoff(showOnly: boolean) {
    if (working.current || blocked || (!showOnly && cannotSet)) return;
    working.current = true;
    setBusy(true);
    setNotice(null);
    try {
      if (showOnly) {
        await openSystemAlarms();
      } else if (result.ok) {
        const message = await sendSystemAlarms(result.alarms, `${day.plan.date} · ${day.name || day.plan.destination}`);
        setNotice({ message, failed: false });
      }
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : 'Nie udało się otworzyć Zegara. Spróbuj ponownie.', failed: true });
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function handoffDeparture() {
    if (working.current || blocked || !result.ok || systemAlarmCreationIssue || departureIssue) return;
    working.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const message = await sendSystemAlarms(departureAlarm, `${day.plan.date} · ${day.name || day.plan.destination}`);
      setNotice({ message, failed: false });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : 'Nie udało się otworzyć Zegara. Spróbuj ponownie.', failed: true });
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <MaterialIcons name="alarm" size={20} color={colors.primary} />
        <Text accessibilityRole="header" style={styles.title}>
          {settings.alarm.seriesEnabled ? 'Seria budzików' : 'Budzik'} · {day.plan.date}
        </Text>
      </View>
      {!result.ok && <Text style={text.body}>{result.message}</Text>}
      {result.ok && (
        <>
          <View style={styles.times}>
            {result.alarms.map(({ date, label }, index) => (
              <View key={date.getTime()} style={[styles.alarm, index === result.alarms.length - 1 && styles.wakeAlarm]}>
                <Text style={styles.time}>{formatTime(date)}</Text>
                <Text style={text.body}>{label}</Text>
                {formatDate(date) !== day.plan.date && <Text style={text.body}>{formatDate(date)}</Text>}
              </View>
            ))}
          </View>
          <Text style={text.body}>
            {settings.alarm.preparationMinutes} min od pobudki do wyjścia o {formatTime(result.departure)}.
            {' '}Godziny w strefie Warszawy; Zegar otrzyma ich odpowiedniki w strefie urządzenia.
          </Text>
          <View style={[styles.alarm, styles.departureAlarm]}>
            <Text style={styles.time}>{formatTime(result.departure)}</Text>
            <Text style={text.body}>Godzina wyjścia</Text>
            {formatDate(result.departure) !== day.plan.date && <Text style={text.body}>{formatDate(result.departure)}</Text>}
          </View>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: cannotSet, busy }}
        disabled={cannotSet}
        onPress={() => { void handoff(false); }}
        style={({ pressed }) => [styles.button, (cannotSet || pressed) && styles.muted]}
      >
        <MaterialIcons name="alarm-add" size={20} color={colors.onPrimary} />
        <Text style={styles.buttonText}>
          {busy ? 'Otwarty Zegar…' : settings.alarm.seriesEnabled ? 'Ustaw serię w Zegarze' : 'Ustaw budzik w Zegarze'}
        </Text>
      </Pressable>
      {systemAlarmCreationIssue ? <Text style={text.body}>{systemAlarmCreationIssue}</Text>
        : issue ? result.ok && <Text style={text.body}>{issue}</Text> : (
          <Text style={text.body}>
            Budziki jednorazowe, tylko dla tego dnia. Jeśli Zegar pozostanie otwarty, wróć do aplikacji, aby przekazać kolejny budzik serii.
          </Text>
        )}
      {result.ok && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: blocked || !!systemAlarmCreationIssue || !!departureIssue, busy }}
            disabled={blocked || !!systemAlarmCreationIssue || !!departureIssue}
            onPress={() => { void handoffDeparture(); }}
            style={({ pressed }) => [styles.secondaryButton, (blocked || !!systemAlarmCreationIssue || !!departureIssue || pressed) && styles.muted]}
          >
            <MaterialIcons name="alarm-add" size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>{busy ? 'Otwarty Zegar…' : 'Ustaw budzik na godzinę wyjścia'}</Text>
          </Pressable>
          {departureIssue && <Text style={text.body}>{departureIssue}</Text>}
        </>
      )}
      {notice && <Text accessibilityLiveRegion="polite" style={notice.failed ? text.error : styles.notice}>{notice.message}</Text>}
      {systemAlarmSupported && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: blocked }}
          disabled={blocked}
          onPress={() => { void handoff(true); }}
          style={({ pressed }) => [styles.clockButton, (blocked || pressed) && styles.muted]}
        >
          <Text style={styles.clockText}>Sprawdź budziki w Zegarze</Text>
          <MaterialIcons name="open-in-new" size={18} color={colors.primary} />
        </Pressable>
      )}
      <Text style={text.body}>Po zmianie lub usunięciu planu popraw budziki bezpośrednio w Zegarze.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, backgroundColor: colors.surfaceContainerLow, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.onSurface },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  alarm: { borderLeftWidth: 2, borderLeftColor: colors.outlineVariant, paddingLeft: 10, gap: 3 },
  wakeAlarm: { borderLeftColor: colors.tertiary },
  departureAlarm: { borderLeftColor: colors.primary },
  time: { fontFamily: fonts.clock, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'], color: colors.primary },
  button: { minHeight: 48, borderRadius: 10, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  buttonText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.onPrimary, textAlign: 'center' },
  secondaryButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  secondaryButtonText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  clockButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  clockText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  notice: { ...text.body, color: colors.tertiary },
  muted: { opacity: 0.5 },
});
