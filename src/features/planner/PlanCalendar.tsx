import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { calendarDate, calendarDateKey, calendarEntry, type CalendarDays } from './calendar';

const monthFormat = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'full', timeZone: 'UTC' });
const weekdays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function getMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
  const dayOffset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayOffset);
  return d;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

export function PlanCalendar({
  selectedDate,
  today,
  drafts,
  savedDays,
  disabled,
  onSelect,
  onOpenDay,
}: {
  selectedDate: string;
  today: string;
  drafts: CalendarDays;
  savedDays: CalendarDays;
  disabled: boolean;
  onSelect: (date: string) => void;
  onOpenDay?: (date: string) => void;
}) {
  const [monthMode, setMonthMode] = useState(false);
  const [weekMonday, setWeekMonday] = useState(() => getMonday(calendarDate(selectedDate)));
  useEffect(() => {
    setWeekMonday(getMonday(calendarDate(selectedDate)));
  }, [selectedDate]);

  const weekDays = useMemo(() => (
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekMonday.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    })
  ), [weekMonday]);

  const headerDate = weekDays[3] ?? weekMonday;
  const year = headerDate.getUTCFullYear();
  const month = headerDate.getUTCMonth();

  const monthWeeks = useMemo(() => {
    const first = new Date(Date.UTC(year, month, 1, 12));
    const offset = (first.getUTCDay() + 6) % 7;
    const totalCells = Math.ceil((offset + new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate()) / 7) * 7;
    const cells = Array.from({ length: totalCells }, (_, index) => new Date(Date.UTC(year, month, index - offset + 1, 12)));
    return Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  }, [year, month]);

  function movePeriod(delta: number) {
    if (monthMode) {
      const next = new Date(Date.UTC(year, month + delta, 1, 12));
      const nextYear = next.getUTCFullYear();
      if (nextYear >= 2000 && nextYear <= 2099) {
        setWeekMonday(getMonday(next));
      }
      return;
    }
    const next = new Date(weekMonday.getTime());
    next.setUTCDate(next.getUTCDate() + delta * 7);
    const nextYear = next.getUTCFullYear();
    if (nextYear >= 2000 && nextYear <= 2099) {
      setWeekMonday(next);
    }
  }

  function handleDayPress(key: string) {
    if (key === selectedDate && onOpenDay) {
      onOpenDay(key);
    } else {
      onSelect(key);
    }
  }

  return (
    <View style={styles.calendar}>
      <View style={styles.headerRow}>
        <Text accessibilityLiveRegion="polite" accessibilityRole="header" style={styles.monthTitle}>
          {capitalize(monthFormat.format(headerDate))}
        </Text>
        <View style={styles.navButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={monthMode ? 'Poprzedni miesiąc' : 'Poprzedni tydzień'}
            disabled={disabled || year <= 2000}
            onPress={() => movePeriod(-1)}
            style={({ pressed }) => [styles.arrowBtn, pressed && styles.pressed]}
          >
            <MaterialIcons name="chevron-left" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={monthMode ? 'Następny miesiąc' : 'Następny tydzień'}
            disabled={disabled || year >= 2099}
            onPress={() => movePeriod(1)}
            style={({ pressed }) => [styles.arrowBtn, pressed && styles.pressed]}
          >
            <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={monthMode ? 'Pokaż widok tygodnia' : 'Pokaż widok miesiąca'}
          accessibilityState={{ expanded: monthMode, disabled }}
          disabled={disabled}
          onPress={() => setMonthMode((value) => !value)}
          style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}
        >
          <MaterialIcons name={monthMode ? 'view-week' : 'calendar-view-month'} size={16} color={colors.primary} />
          <Text style={styles.toolbarText}>{monthMode ? 'Zwiń do tygodnia' : 'Cały miesiąc'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Przejdź do bieżącego tygodnia"
          disabled={disabled}
          onPress={() => {
            onSelect(today);
            setWeekMonday(getMonday(calendarDate(today)));
          }}
          style={({ pressed }) => [styles.toolbarButton, pressed && styles.pressed]}
        >
          <Text style={styles.toolbarText}>Dziś</Text>
        </Pressable>
      </View>

      {/* Weekday Labels Row */}
      <View style={styles.weekHeader}>
        {weekdays.map((label, idx) => (
          <Text key={label} style={[styles.weekday, idx >= 5 && styles.weekdayWeekend]}>
            {label}
          </Text>
        ))}
      </View>

      {/* 7-Day Strip or Full Month Grid */}
      {!monthMode ? (
        <View style={styles.weekRow}>
          {weekDays.map((date, index) => {
            const key = calendarDateKey(date);
            const dayNum = date.getUTCDate();
            const selected = key === selectedDate;
            const isToday = key === today;
            const isWeekend = index >= 5;
            const stored = calendarEntry(savedDays, key);
            const draft = drafts[key];
            const entry = draft ?? stored?.day;
            const topLabel = entry ? entry.plan.time : ' ';

            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                disabled={disabled}
                accessibilityLabel={`${dayFormat.format(date)}${isToday ? ', dzisiaj' : ''}${entry ? `, dotarcie ${entry.plan.time}` : ''}${stored?.day.recurrence ? ', plan cykliczny' : ''}${draft ? ', niezapisany szkic' : ''}`}
                accessibilityState={{ selected, disabled }}
                onPress={() => handleDayPress(key)}
                style={({ pressed }) => [
                  styles.dayCell,
                  isToday && !selected && styles.todayCell,
                  selected && styles.selectedCell,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    isWeekend && !selected && !entry && styles.weekendDayNumber,
                    selected && styles.selectedText,
                  ]}
                >
                  {dayNum}
                </Text>
                <Text numberOfLines={1} style={[styles.dayTopLabel, selected && styles.selectedTopLabel]}>
                  {topLabel}
                </Text>
                <View style={styles.dotsRow}>
                  {stored ? (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: selected ? colors.onPrimary : stored.day.recurrence ? colors.tertiary : colors.primary },
                      ]}
                    />
                  ) : null}
                  {draft ? (
                    <View style={[styles.dot, { backgroundColor: selected ? colors.onPrimary : colors.secondaryFixed }]} />
                  ) : null}
                  {!stored && !draft && <View style={styles.dotPlaceholder} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.monthGrid}>
          {monthWeeks.map((week, rowIdx) => (
            <View key={rowIdx} style={styles.weekRow}>
              {week.map((date, idx) => {
                const key = calendarDateKey(date);
                const dayNum = date.getUTCDate();
                const inMonth = date.getUTCMonth() === month;
                const selected = key === selectedDate;
                const isToday = key === today;
                const isWeekend = idx >= 5;
                const stored = calendarEntry(savedDays, key);
                const draft = drafts[key];
                const entry = draft ?? stored?.day;

                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    disabled={disabled}
                    accessibilityLabel={`${dayFormat.format(date)}${isToday ? ', dzisiaj' : ''}${entry ? `, dotarcie ${entry.plan.time}` : ''}${stored?.day.recurrence ? ', plan cykliczny' : ''}${draft ? ', niezapisany szkic' : ''}`}
                    accessibilityState={{ selected, disabled }}
                    onPress={() => handleDayPress(key)}
                    style={({ pressed }) => [
                      styles.monthDayCell,
                      !inMonth && !selected && styles.outsideMonthCell,
                      isToday && !selected && styles.todayCell,
                      selected && styles.selectedCell,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthDayNumber,
                        isWeekend && !selected && styles.weekendDayNumber,
                        selected && styles.selectedText,
                      ]}
                    >
                      {dayNum}
                    </Text>
                    {entry ? (
                      <Text numberOfLines={1} style={[styles.monthDayTime, selected && styles.selectedTopLabel]}>
                        {entry.plan.time}
                      </Text>
                    ) : null}
                    <View style={styles.dotsRow}>
                      {stored ? (
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: selected ? colors.onPrimary : stored.day.recurrence ? colors.tertiary : colors.primary },
                          ]}
                        />
                      ) : null}
                      {draft ? (
                        <View style={[styles.dot, { backgroundColor: selected ? colors.onPrimary : colors.secondaryFixed }]} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {monthMode && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Zapisany plan</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.tertiary }]} />
            <Text style={styles.legendText}>Plan cykliczny</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.secondaryFixed }]} />
            <Text style={styles.legendText}>Szkic w edycji</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthTitle: { flex: 1, fontSize: 18, lineHeight: 24, fontWeight: '600', color: colors.onSurface },
  navButtons: { flexDirection: 'row' },
  arrowBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -8 },
  toolbarButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  toolbarText: { fontSize: 12, fontWeight: '500', color: colors.primary },
  weekHeader: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.onSurfaceVariant },
  weekdayWeekend: { color: colors.outline },
  weekRow: { flexDirection: 'row', gap: 4 },
  monthGrid: { gap: 5 },
  dayCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    paddingVertical: 9,
    paddingHorizontal: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  monthDayCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    paddingVertical: 5,
    paddingHorizontal: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outsideMonthCell: { opacity: 0.3 },
  todayCell: { borderColor: colors.primary },
  selectedCell: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTopLabel: { fontFamily: fonts.clock, fontSize: 10, lineHeight: 14, color: colors.onSurfaceVariant },
  selectedTopLabel: { color: colors.onPrimary },
  dayNumber: { fontSize: 18, lineHeight: 22, fontWeight: '600', color: colors.onSurface },
  monthDayNumber: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.onSurface },
  monthDayTime: { fontFamily: fonts.clock, fontSize: 10, color: colors.onSurfaceVariant },
  weekendDayNumber: { color: colors.outline },
  selectedText: { color: colors.onPrimary },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 2, minHeight: 6 },
  dotPlaceholder: { width: 5, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 10, color: colors.onSurfaceVariant },
  pressed: { opacity: 0.7 },
});
