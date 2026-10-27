import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from '@/components/SafeAreaView';

import { colors, fonts, text } from '@/constants/theme';
import { calendarDate, calendarEntry } from './calendar';
import { formatDate } from './plan';
import { PlanCalendar } from './PlanCalendar';
import { PlanDayEditor } from './PlanDayEditor';
import { formatRecurrenceSummary } from './RecurrenceFields';
import type { SavedPoint } from './settings';
import { useStoredSettings } from './StoredSettingsProvider';
import { useStoredPlan } from './useStoredPlan';
import { UpcomingPlanPanel } from './UpcomingPlanPanel';

const weekdayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

function formatSelectedDayHeader(dateStr: string): string {
  const date = calendarDate(dateStr);
  const weekday = weekdayNames[date.getUTCDay()] ?? 'Dzień';
  return `${weekday}, ${dateStr.slice(0, 5)}`;
}

export default function PlannerScreen() {
  const router = useRouter();
  const store = useStoredPlan();
  const { settings } = useStoredSettings();
  const [editorVisible, setEditorVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const today = formatDate(new Date(now));

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);

  function openPlan(date: string) {
    if (store.saving) return;
    store.selectDate(date);
    setEditorVisible(true);
  }

  function openWithDestinationShortcut(endPoint: SavedPoint) {
    if (store.saving) return;
    if (!store.plan.fromStop && settings.startPoints[0]) {
      const start = settings.startPoints[0];
      store.updatePlan('origin', start.name);
      store.updatePlan('fromStop', start.stop);
      store.updatePlan('walkToMinutes', start.walkMinutes);
    }
    store.updatePlan('destination', endPoint.name);
    store.updatePlan('toStop', endPoint.stop);
    store.updatePlan('walkFromMinutes', endPoint.walkMinutes);
    store.updatePlan('bufferMinutes', settings.bufferMinutes);
    setEditorVisible(true);
  }

  if (store.loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.loading}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Wczytywanie kalendarza" />
        <Text style={text.body}>Wczytuję Twój kalendarz…</Text>
      </SafeAreaView>
    );
  }

  const selectedStored = calendarEntry(store.savedDays, store.selectedDate);
  const selectedDraft = store.drafts[store.selectedDate];
  const activeEntry = selectedDraft ?? selectedStored?.day ?? null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <Text accessibilityRole="header" style={styles.screenTitle}>Plan dojazdów</Text>
        <Text style={styles.todayText}>{today}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!editorVisible && (
          <UpcomingPlanPanel
            days={store.savedDays}
            now={now}
            onOpen={openPlan}
          />
        )}

        <PlanCalendar
          selectedDate={store.selectedDate}
          today={today}
          drafts={store.drafts}
          savedDays={store.savedDays}
          disabled={store.saving}
          onSelect={(date) => store.selectDate(date)}
          onOpenDay={openPlan}
        />

        <View style={styles.selectedDaySection}>
          <Text accessibilityRole="header" style={styles.selectedDayTitle}>
            {formatSelectedDayHeader(store.selectedDate)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={activeEntry
              ? `Edytuj plan na ${store.selectedDate}. ${activeEntry.name ? `${activeEntry.name}. ` : ''}${activeEntry.plan.origin || 'Punkt startowy'} do ${activeEntry.plan.destination || 'Cel podróży'}, dotarcie ${activeEntry.plan.time || 'nieustalone'}. ${selectedDraft ? 'Niezapisany szkic.' : formatRecurrenceSummary(activeEntry.recurrence)}`
              : `Dodaj plan na ${store.selectedDate}`}
            accessibilityState={{ disabled: store.saving }}
            disabled={store.saving}
            onPress={() => openPlan(store.selectedDate)}
            style={({ pressed }) => [styles.dayPlanCard, pressed && styles.pressed]}
          >
            {activeEntry ? (
              <>
                <View style={styles.dayPlanTimeGroup}>
                  <Text style={styles.dayPlanTime}>{activeEntry.plan.time}</Text>
                  <Text style={styles.dayPlanCaption}>dotarcie</Text>
                </View>
                <View style={styles.dayPlanInfo}>
                  <Text style={styles.dayPlanName}>
                    {activeEntry.name || activeEntry.plan.destination || 'Nowy plan'}
                  </Text>
                  <Text style={styles.dayPlanRoute}>
                    {activeEntry.plan.origin || 'Punkt startowy'} → {activeEntry.plan.destination || 'Cel podróży'}
                  </Text>
                  {selectedDraft || activeEntry.recurrence ? (
                    <Text style={styles.dayPlanStatus}>
                      {selectedDraft ? 'Niezapisany szkic' : formatRecurrenceSummary(activeEntry.recurrence)}
                    </Text>
                  ) : null}
                </View>
                <MaterialIcons name="chevron-right" size={22} color={colors.onSurfaceVariant} />
              </>
            ) : (
              <>
                <MaterialIcons name="add" size={24} color={colors.primary} />
                <View style={styles.dayPlanInfo}>
                  <Text style={styles.dayPlanName}>Dodaj plan</Text>
                  <Text style={styles.dayPlanRoute}>Ten dzień jest jeszcze wolny.</Text>
                </View>
              </>
            )}
          </Pressable>
        </View>

        {!activeEntry && settings.endPoints.length > 0 && (
          <View style={styles.shortcutsSection}>
            <Text style={styles.shortcutsLabel}>Dokąd jedziesz?</Text>
            <View style={styles.shortcutsRow}>
              {settings.endPoints.map((endPoint) => (
                <Pressable
                  key={endPoint.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Zaplanuj dojazd do ${endPoint.name}`}
                  accessibilityState={{ disabled: store.saving }}
                  disabled={store.saving}
                  onPress={() => openWithDestinationShortcut(endPoint)}
                  style={({ pressed }) => [styles.shortcutChip, pressed && styles.pressed]}
                >
                  <MaterialIcons name="place" size={16} color={colors.primary} />
                  <Text style={styles.shortcutText}>{endPoint.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {settings.endPoints.length === 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.configurePoints, pressed && styles.pressed]}
          >
            <Text style={styles.configurePointsText}>Dodaj zapisane miejsca w ustawieniach</Text>
            <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
        )}

        {store.storageError && <Text accessibilityLiveRegion="polite" style={text.error}>{store.storageError}</Text>}
        {store.migrationNotice && <Text accessibilityLiveRegion="polite" style={text.body}>{store.migrationNotice}</Text>}
      </ScrollView>

      {editorVisible && (
        <Modal animationType="slide" onRequestClose={() => { if (!store.saving) setEditorVisible(false); }}>
          <PlanDayEditor store={store} onClose={() => setEditorVisible(false)} />
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.surface },
  topBar: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  screenTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.onSurface },
  todayText: { fontSize: 12, fontWeight: '500', color: colors.primary },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 16, paddingBottom: 32, gap: 24 },
  selectedDaySection: { gap: 12 },
  selectedDayTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.onSurface },
  dayPlanCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dayPlanTimeGroup: { alignItems: 'center', gap: 4 },
  dayPlanTime: { fontFamily: fonts.clock, fontSize: 19, fontWeight: '700', color: colors.onSurface, fontVariant: ['tabular-nums'] },
  dayPlanCaption: { fontSize: 10, color: colors.onSurfaceVariant },
  dayPlanInfo: { flex: 1, gap: 4 },
  dayPlanName: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.onSurface },
  dayPlanRoute: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant },
  dayPlanStatus: { fontSize: 11, lineHeight: 16, color: colors.primary },
  shortcutsSection: { gap: 10 },
  shortcutsLabel: { fontSize: 12, color: colors.onSurfaceVariant },
  shortcutsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcutChip: {
    minHeight: 44,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
  },
  shortcutText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: colors.onSurface },
  configurePoints: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  configurePointsText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.primary },
  pressed: { opacity: 0.7 },
});
