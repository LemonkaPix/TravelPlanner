import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, text } from '@/constants/theme';
import type { CalendarDays } from './calendar';
import { exportPlansFile, pickPlansFile } from './planFiles';
import { importableDays, parsePlans, PlanTransferError, serializePlans } from './planTransfer';
import { useStoredSettings } from './StoredSettingsProvider';
import type { StoredPlan } from './useStoredPlan';

function TransferButton({ label, disabled, secondary = false, onPress }: {
  label: string; disabled: boolean; secondary?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || pressed) && styles.muted]}>
      <Text style={secondary ? styles.secondaryLabel : styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function PlanTransferPanel({ store, onBusyChange }: { store: StoredPlan; onBusyChange: (busy: boolean) => void }) {
  const { loading: settingsLoading, saving: settingsSaving } = useStoredSettings();
  const [busy, setBusy] = useState(false);
  const inProgress = useRef(false);
  const [pending, setPending] = useState<CalendarDays | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = busy || store.loading || store.saving || settingsLoading || settingsSaving;
  const count = Object.keys(store.savedDays).length;
  const total = pending ? Object.keys(pending).length : 0;
  const available = pending ? Object.keys(importableDays(pending, store.savedDays, store.drafts)).length : 0;

  async function run(action: () => Promise<void>) {
    if (disabled || inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    onBusyChange(true);
    setNotice(null);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof PlanTransferError ? failure.message : 'Nie udało się przetworzyć pliku. Spróbuj ponownie.');
    } finally {
      inProgress.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function chooseFile() {
    setPending(null);
    const content = await pickPlansFile();
    if (content === null) return;
    const days = parsePlans(content);
    if (Object.keys(days).length === 0) setNotice('Plik nie zawiera żadnych planów.');
    else setPending(days);
  }

  async function confirmImport() {
    if (!pending) return;
    const added = await store.importDays(pending);
    if (added === null) {
      setError('Import nie został zapisany. Szczegóły znajdziesz w komunikacie kalendarza. Spróbuj ponownie.');
      return;
    }
    setPending(null);
    setNotice(`Import zakończony. Dodane plany: ${added}. Pominięte: ${total - added}.`);
  }

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={text.heading}>Eksport i import planów</Text>
      <Text style={text.body}>Zapisz plany w pliku JSON lub przenieś je na inne urządzenie. Eksport obejmuje zapisane dni i cykle, wraz z nazwami, trasami i godzinami. Szkice nie są eksportowane.</Text>
      <TransferButton label="Eksportuj plany" disabled={disabled || count === 0 || !!pending} secondary onPress={() => { void run(async () => {
        await exportPlansFile(serializePlans(store.savedDays));
        setNotice(Platform.OS === 'web' ? 'Rozpoczęto pobieranie pliku planów.' : 'Zamknięto okno eksportu. Zapis pliku zależy od wybranej w nim czynności.');
      }); }} />
      {count === 0 && <Text style={text.body}>Zapisz pierwszy plan, aby go wyeksportować.</Text>}
      <TransferButton label="Importuj z pliku" disabled={disabled} secondary onPress={() => { void run(chooseFile); }} />
      {pending && <View style={styles.preview}>
        <Text accessibilityRole="header" style={text.label}>Podgląd importu</Text>
        <Text style={text.body}>Plany w pliku: {total}. Do dodania: {available}. Do pominięcia: {total - available}.</Text>
        <Text style={text.body}>Plany z tą samą datą początkową co zapisany plan lub szkic zostaną pominięte. Cykle zachowają reguły powtarzania; na wspólnych dniach kalendarz wybiera pojedynczy plan lub cykl z późniejszą datą początkową. Brakujące punkty początkowe i końcowe zostaną dodane do ustawień.</Text>
        <TransferButton label="Dodaj plany" disabled={disabled || available === 0} onPress={() => { void run(confirmImport); }} />
        <TransferButton label="Anuluj import" disabled={disabled} secondary onPress={() => { setPending(null); setError(null); }} />
      </View>}
      {busy && <Text accessibilityLiveRegion="polite" style={text.body}>Przetwarzam plik…</Text>}
      {notice && <Text accessibilityLiveRegion="polite" style={text.body}>{notice}</Text>}
      {error && <Text accessibilityLiveRegion="polite" style={text.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 22, backgroundColor: colors.white, borderRadius: 22, gap: 16 },
  preview: { gap: 14, borderTopWidth: 1, borderTopColor: colors.background, paddingTop: 16 },
  button: { borderRadius: 14, backgroundColor: colors.blue, minHeight: 50, padding: 14, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.background },
  buttonLabel: { color: colors.white, fontSize: 16, fontWeight: '600' },
  secondaryLabel: { color: colors.blue, fontSize: 16, fontWeight: '600' },
  muted: { opacity: 0.55 },
});
