import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Modal, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, text } from '@/constants/theme';
import { formatDate } from './plan';
import { PlanCalendar } from './PlanCalendar';
import { PlanDayEditor } from './PlanDayEditor';
import { useStoredPlan } from './useStoredPlan';
import { UpcomingPlanPanel } from './UpcomingPlanPanel';

export default function PlannerScreen() {
  const store = useStoredPlan();
  const [editorVisible, setEditorVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const today = formatDate(new Date(now));

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
        setRefreshVersion((version) => version + 1);
      }
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, []);

  function openPlan(date: string) {
    store.selectDate(date);
    setEditorVisible(true);
  }

  if (store.loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.loading}>
        <ActivityIndicator color={colors.blue} accessibilityLabel="Wczytywanie kalendarza" />
        <Text style={text.body}>Wczytuję Twój kalendarz…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {!editorVisible && <UpcomingPlanPanel days={store.savedDays} now={now} refreshVersion={refreshVersion} onOpen={openPlan} />}
        <PlanCalendar selectedDate={store.selectedDate} today={today} drafts={store.drafts} savedDays={store.savedDays}
          disabled={store.saving} onSelect={openPlan} />
        {store.storageError && <Text accessibilityLiveRegion="polite" style={text.error}>{store.storageError}</Text>}
        {store.migrationNotice && <Text accessibilityLiveRegion="polite" style={text.body}>{store.migrationNotice}</Text>}
      </ScrollView>
      {editorVisible && <Modal animationType="slide" onRequestClose={() => { if (!store.saving) setEditorVisible(false); }}>
        <PlanDayEditor store={store} onClose={() => setEditorVisible(false)} />
      </Modal>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 20 },
});
