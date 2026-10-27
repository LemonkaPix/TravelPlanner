import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, text } from '@/constants/theme';
import { calendarDate, calendarDateKey, nextCalendarEntry, type CalendarDays } from './calendar';
import { calculatePlan, formatDate, formatTime } from './plan';

function formatRelativeTime(targetMs: number, nowMs: number): string {
  const diffMinutes = Math.ceil((targetMs - nowMs) / 60_000);
  if (targetMs < nowMs) return 'Godzina wyjścia minęła';
  if (diffMinutes === 0) return 'Czas wyjść';
  if (diffMinutes < 60) return `za ${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (hours < 24) return mins > 0 ? `za ${hours} godz. ${mins} min` : `za ${hours} godz.`;
  return `za ${Math.floor(hours / 24)} dn.`;
}

function formatDayLabel(date: string, nowMs: number): string {
  const today = formatDate(new Date(nowMs));
  if (date === today) return 'Dzisiaj';
  const tomorrow = calendarDate(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return date === calendarDateKey(tomorrow) ? 'Jutro' : date;
}

export function UpcomingPlanPanel({
  days,
  now,
  onOpen,
}: {
  days: CalendarDays;
  now: number;
  onOpen: (date: string) => void;
}) {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const entry = useMemo(() => nextCalendarEntry(days, now), [days, now]);
  const day = entry?.day;
  const plan = day?.plan;
  const result = plan ? calculatePlan(plan) : null;

  if (!entry || !day || !plan) {
    return (
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Zaplanuj kolejny dojazd</Text>
        <Text style={text.body}>Wybierz dzień i dodaj trasę.</Text>
      </View>
    );
  }

  const expanded = expandedPlan === plan.date;
  const firstRide = result?.ok ? result.connection.legs.find((leg) => !leg.walking) : null;
  const departurePassed = result?.ok && result.departure.getTime() < now;
  const totalMinutes = result?.ok
    ? Math.round((result.destinationArrival.getTime() - result.departure.getTime()) / 60_000)
    : null;
  const spareMinutes = result?.ok
    ? Math.round((result.arrival.getTime() - result.destinationArrival.getTime()) / 60_000)
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text style={styles.dateLabel}>
          {formatDayLabel(plan.date, now)} · dotarcie do {plan.time}
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          {day.name ? `${day.name} · ${plan.destination}` : plan.destination}
        </Text>
      </View>

      {result?.ok ? (
        <View style={styles.departure}>
          <Text
            accessibilityLabel={`${departurePassed ? 'Wyjście było o' : 'Wyjdź o'} ${formatTime(result.departure)}`}
            style={[styles.departureHeadline, departurePassed && styles.warning]}
          >
            {departurePassed ? 'Wyjście było o' : 'Wyjdź o'}{' '}
            <Text style={styles.departureTime}>{formatTime(result.departure)}</Text>
          </Text>
          <Text style={[styles.countdown, departurePassed && styles.warning]}>
            {formatRelativeTime(result.departure.getTime(), now)}
            {formatDate(result.departure) !== plan.date ? ` · ${formatDate(result.departure)}` : ''}
          </Text>
        </View>
      ) : (
        <Text accessibilityLiveRegion="polite" style={text.error}>
          {result && 'message' in result ? result.message : 'Sprawdź punkty i termin planu.'}
          {' '}Otwórz plan, aby uzupełnić połączenie.
        </Text>
      )}

      {firstRide && (
        <View style={styles.boarding}>
          <MaterialIcons name="directions-transit" size={20} color={colors.primary} />
          <View style={styles.boardingCopy}>
            <Text style={styles.boardingTitle}>
              {firstRide.label} · odjazd {formatTime(new Date(firstRide.departure))}
            </Text>
            <Text style={styles.route}>{plan.fromStop?.label ?? plan.origin}</Text>
          </View>
        </View>
      )}

      {result?.ok ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? 'Ukryj szczegóły trasy' : 'Pokaż szczegóły trasy'}
            onPress={() => setExpandedPlan(expanded ? null : plan.date)}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>Szczegóły trasy</Text>
            <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color={colors.primary} />
          </Pressable>
          {expanded && (
            <View style={styles.details}>
              <Text style={styles.detailSummary}>{totalMinutes} min podróży · {spareMinutes} min zapasu</Text>
              <Text style={styles.detailText}>{plan.origin} → {plan.destination}</Text>
              <Text style={styles.detailText}>Dojście do przystanku: {plan.walkToMinutes} min</Text>
              {result.connection.legs.map((leg, index) => (
                <View key={`${leg.departure}-${index}`} style={styles.leg}>
                  <Text style={styles.legTime}>
                    {formatTime(new Date(leg.departure))}–{formatTime(new Date(leg.arrival))}
                  </Text>
                  <Text style={styles.detailText}>
                    {leg.walking ? `Pieszo · ${leg.label}` : leg.label}{'\n'}
                    {leg.from} → {leg.to}
                    {formatDate(new Date(leg.departure)) !== plan.date
                      ? `\nOdjazd: ${formatDate(new Date(leg.departure))}` : ''}
                    {formatDate(new Date(leg.arrival)) !== formatDate(new Date(leg.departure))
                      ? `\nPrzyjazd: ${formatDate(new Date(leg.arrival))}` : ''}
                  </Text>
                </View>
              ))}
              <Text style={styles.detailText}>Dojście do celu: {plan.walkFromMinutes} min</Text>
              <Text style={styles.arrival}>
                Na miejscu o {formatTime(result.destinationArrival)}
                {formatDate(result.destinationArrival) !== plan.date
                  ? ` · ${formatDate(result.destinationArrival)}` : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpen(plan.date)}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>Edytuj plan</Text>
                <MaterialIcons name="edit" size={18} color={colors.primary} />
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(plan.date)}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>Uzupełnij plan</Text>
          <MaterialIcons name="arrow-forward" size={20} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    gap: 12,
  },
  heading: { gap: 5 },
  dateLabel: { fontSize: 13, color: colors.primary },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.onSurface },
  route: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },
  departure: { paddingVertical: 4, alignItems: 'flex-start', gap: 2 },
  departureHeadline: { fontSize: 18, lineHeight: 56, fontWeight: '500', color: colors.onSurface },
  departureTime: {
    fontFamily: fonts.clock,
    fontSize: 40,
    lineHeight: 56,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    color: colors.primary,
  },
  countdown: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant },
  warning: { color: colors.error },
  boarding: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boardingCopy: { flex: 1, gap: 3 },
  boardingTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.onSurface },
  action: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    paddingTop: 10,
  },
  actionText: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.primary },
  details: { gap: 14 },
  detailSummary: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: colors.onSurface },
  detailText: { fontSize: 13, lineHeight: 20, color: colors.onSurfaceVariant },
  leg: { paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.outlineVariant, gap: 4 },
  legTime: { fontFamily: fonts.clock, fontSize: 13, fontWeight: '600', color: colors.onSurface },
  arrival: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.tertiary },
  pressed: { opacity: 0.7 },
});
