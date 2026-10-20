import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, text } from '@/constants/theme';
import { calendarDate, calendarDateKey, calendarEntry, type CalendarDays } from './calendar';

const monthFormat = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'full', timeZone: 'UTC' });
const weekdays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

export function PlanCalendar({ selectedDate, today, drafts, savedDays, disabled, onSelect }: {
  selectedDate: string; today: string; drafts: CalendarDays; savedDays: CalendarDays;
  disabled: boolean; onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => calendarDate(selectedDate));
  useEffect(() => { setMonth(calendarDate(selectedDate)); }, [selectedDate]);
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, monthIndex, 1, 12));
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, monthIndex + 1, 0, 12)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= count ? new Date(Date.UTC(year, monthIndex, day, 12)) : null;
  });

  function moveMonth(amount: number) {
    setMonth(new Date(Date.UTC(year, monthIndex + amount, 1, 12)));
  }

  return (
    <View style={styles.calendar}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={text.heading}>Twój kalendarz</Text>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setMonth(calendarDate(today))} style={styles.todayButton}>
          <Text style={styles.todayText}>Dzisiaj</Text>
        </Pressable>
      </View>
      <Text style={text.body}>Wybierz dzień i przypisz mu połączenie.</Text>
      <View style={styles.navigation}>
        <Pressable accessibilityRole="button" accessibilityLabel="Poprzedni miesiąc"
          disabled={disabled || (year === 2000 && monthIndex === 0)}
          accessibilityState={{ disabled: disabled || (year === 2000 && monthIndex === 0) }}
          onPress={() => moveMonth(-1)} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.month}>{monthFormat.format(month)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Następny miesiąc"
          disabled={disabled || (year === 2099 && monthIndex === 11)}
          accessibilityState={{ disabled: disabled || (year === 2099 && monthIndex === 11) }}
          onPress={() => moveMonth(1)} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.week}>
        {weekdays.map((label) => <Text key={label} style={styles.weekday}>{label}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={week} style={styles.week}>
          {cells.slice(week * 7, week * 7 + 7).map((date, index) => {
            if (!date) return <View key={`empty-${index}`} style={styles.cell} />;
            const key = calendarDateKey(date);
            const selected = key === selectedDate;
            const stored = calendarEntry(savedDays, key);
            const entry = drafts[key] ?? stored?.day;
            const saved = !!stored && JSON.stringify(stored.day) === JSON.stringify(entry);
            return (
              <Pressable key={key} accessibilityRole="button" disabled={disabled}
                accessibilityLabel={`${dayFormat.format(date)}${key === today ? ', dzisiaj' : ''}${entry ? `, ${entry.name || 'Plan'}, dotarcie ${entry.plan.time}${entry.recurrence ? ', plan cykliczny' : ''}, ${saved ? 'zapisany plan' : 'niezapisane zmiany'}` : ', brak planu'}`}
                accessibilityState={{ selected, disabled }} onPress={() => onSelect(key)}
                style={({ pressed }) => [styles.cell, styles.day, key === today && styles.today, selected && styles.selected, pressed && styles.pressed]}>
                <Text style={[styles.dayNumber, selected && styles.selectedText]}>{date.getUTCDate()}</Text>
                <Text numberOfLines={1} style={[styles.dayName, selected && styles.selectedText]}>{entry ? entry.name || 'Plan' : ' '}</Text>
                <Text numberOfLines={1} style={[styles.dayTime, selected && styles.selectedText]}>{entry ? `${entry.recurrence ? '↻ ' : ''}${entry.plan.time}` : ' '}</Text>
                <View style={[styles.marker, entry && (saved ? styles.savedMarker : styles.draftMarker), selected && saved && styles.selectedSavedMarker, selected && entry && styles.selectedMarker]} />
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text style={styles.legend}>● Zapisany dzień · ○ Zmiany do zapisania · ↻ Cykl{`\n`}Kliknij dzień, aby dodać lub edytować plan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { padding: 16, backgroundColor: colors.white, borderRadius: 22, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  todayButton: { paddingHorizontal: 10, minHeight: 44, justifyContent: 'center' },
  todayText: { color: colors.blue, fontSize: 13, fontWeight: '600' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.blue, fontSize: 30 },
  month: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 17, fontWeight: '600', textTransform: 'capitalize' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, paddingVertical: 6 },
  cell: { flex: 1, minWidth: 0, minHeight: 80 },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'transparent', gap: 3 },
  today: { borderColor: colors.blue },
  selected: { backgroundColor: colors.blue, borderColor: colors.blue },
  dayNumber: { fontSize: 16, color: colors.ink, fontWeight: '600' },
  dayName: { maxWidth: '100%', fontSize: 10, color: colors.ink },
  dayTime: { fontSize: 9, color: colors.muted, fontFamily: fonts.clock, fontVariant: ['tabular-nums'] },
  selectedText: { color: colors.white },
  marker: { height: 5, width: 5, borderRadius: 3 },
  savedMarker: { backgroundColor: colors.blue },
  draftMarker: { borderWidth: 1, borderColor: colors.blue },
  selectedSavedMarker: { backgroundColor: colors.white },
  selectedMarker: { borderColor: colors.white },
  pressed: { opacity: 0.6 },
  legend: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 6 },
});
