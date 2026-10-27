import { MaterialIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, text } from '@/constants/theme';
import { useStoredPlan } from '../planner/useStoredPlan';
import { widgetAvailabilityIssue } from './widgetAvailability';

export function WidgetSettingsSection() {
  const { loading, saving, widgetError, refreshWidgets } = useStoredPlan();
  const [busy, setBusy] = useState(false);
  const inProgress = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  if (Platform.OS !== 'android') return null;
  const issue = widgetAvailabilityIssue();
  const disabled = !!issue || loading || saving || busy;

  async function act(pin: boolean) {
    if (disabled || inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    setNotice(null);
    try {
      if (pin) {
        const { pinPlanWidget } = await import('./manage');
        const requested = await pinPlanWidget();
        setNotice(requested
          ? 'Potwierdź dodanie widgetu w oknie systemowym.'
          : 'Przytrzymaj puste miejsce na pulpicie, wybierz Widgety → TravelPlanner → Najbliższy dojazd.');
      } else if (await refreshWidgets()) {
        setNotice('Wysłano odświeżenie dodanych widgetów.');
      }
    } catch {
      setNotice('Nie udało się otworzyć okna dodawania. Dodaj widget przez menu Widgety na pulpicie.');
    } finally {
      inProgress.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <MaterialIcons name="widgets" size={20} color={colors.primary} />
        <Text accessibilityRole="header" style={text.heading}>Widget na pulpicie</Text>
      </View>
      <Text style={text.body}>
        Godzina wyjścia, cel, termin dotarcia i pierwszy odjazd z najbliższego zapisanego planu. Widget uwzględnia powtarzanie planów.
      </Text>
      <Text style={text.body}>
        Przytrzymaj puste miejsce na pulpicie, wybierz Widgety → TravelPlanner → Najbliższy dojazd. Dotknięcie planu otworzy planer.
      </Text>
      <Text style={text.body}>
        Dane odświeżają się po zapisaniu planu i otwarciu aplikacji. W tle Android odświeża je nie częściej niż co 30 minut i może opóźniać aktualizacje. Przycisk „Odśwież” na widżecie pozwala pobrać aktualny plan.
      </Text>
      {issue && <Text style={text.body}>{issue}</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => { void act(true); }} style={({ pressed }) => [styles.primaryButton, (disabled || pressed) && styles.muted]}>
        <MaterialIcons name="add-to-home-screen" size={20} color={colors.onPrimary} />
        <Text style={styles.primaryLabel}>Dodaj widget</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => { void act(false); }} style={({ pressed }) => [styles.refreshButton, (disabled || pressed) && styles.muted]}>
        <Text style={styles.refreshLabel}>{busy ? 'Chwilę…' : 'Odśwież widgety'}</Text>
      </Pressable>
      {widgetError && <Text accessibilityLiveRegion="polite" style={text.error}>{widgetError}</Text>}
      {notice && <Text accessibilityLiveRegion="polite" style={text.body}>{notice}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, padding: 18, borderRadius: 20, backgroundColor: colors.surfaceContainerLow },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryLabel: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  refreshButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  refreshLabel: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  muted: { opacity: 0.5 },
});
