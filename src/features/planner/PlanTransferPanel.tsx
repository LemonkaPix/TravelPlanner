import { MaterialIcons } from '@expo/vector-icons';
import { useRef, useState, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, shadows, text } from '@/constants/theme';
import type { CalendarDays } from './calendar';
import { exportPlansFile, pickPlansFile } from './planFiles';
import { importableDays, parsePlans, PlanTransferError, serializePlans } from './planTransfer';
import { useStoredSettings } from './StoredSettingsProvider';
import type { StoredPlan } from './useStoredPlan';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

function TransferActionRow({ icon, iconColor, title, subtitle, disabled, onPress }: {
  icon: IconName;
  iconColor: string;
  title: string;
  subtitle: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, (disabled || pressed) && styles.muted]}
    >
      <View style={styles.iconBox}>
        <MaterialIcons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.actionCopy}>
        <Text numberOfLines={1} style={styles.actionTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
    </Pressable>
  );
}

export function PlanTransferPanel({ store, onBusyChange }: { store: StoredPlan; onBusyChange?: (busy: boolean) => void }) {
  const { loading: settingsLoading, saving: settingsSaving } = useStoredSettings();
  const [busy, setBusy] = useState(false);
  const inProgress = useRef(false);
  const [pending, setPending] = useState<CalendarDays | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = busy || store.loading || store.saving || settingsLoading || settingsSaving;
  const total = pending ? Object.keys(pending).length : 0;
  const available = pending ? Object.keys(importableDays(pending, store.savedDays, store.drafts)).length : 0;

  async function run(action: () => Promise<void>) {
    if (disabled || inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setNotice(null);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof PlanTransferError ? failure.message : 'Nie udało się przetworzyć pliku. Spróbuj ponownie.');
    } finally {
      inProgress.current = false;
      setBusy(false);
      onBusyChange?.(false);
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
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MaterialIcons name="cloud-sync" size={20} color={colors.primary} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>Kopie zapasowe i przenoszenie planów</Text>
      </View>

      <TransferActionRow
        icon="file-upload"
        iconColor={colors.secondary}
        title="Eksportuj plany do pliku (.json)"
        subtitle="Zapisz połączenia, punkty i cykle w pliku"
        disabled={disabled || !!pending}
        onPress={() => {
          void run(async () => {
            await exportPlansFile(serializePlans(store.savedDays));
            setNotice(Platform.OS === 'web'
              ? 'Rozpoczęto pobieranie pliku planów.'
              : 'Zamknięto okno eksportu. Zapis pliku zależy od wybranej w nim czynności.');
          });
        }}
      />

      <TransferActionRow
        icon="file-download"
        iconColor={colors.primary}
        title="Importuj plany z pliku (.json)"
        subtitle="Wczytaj zapisane plany lub punkty z pliku"
        disabled={disabled}
        onPress={() => { void run(chooseFile); }}
      />

      {pending && (
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Text accessibilityRole="header" style={styles.previewTitle}>Podgląd importu</Text>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>+{available} do dodania</Text>
            </View>
          </View>
          <Text style={text.body}>
            Plany w pliku: {total}. Do dodania: {available}. Do pominięcia: {total - available}.
          </Text>
          {Object.values(pending).some((day) => day.plan.legs.length === 0) && (
            <Text style={text.body}>Część planów pochodzi ze starszej wersji. Po imporcie uzupełnij w nich ręcznie linie i godziny połączeń.</Text>
          )}
          <Text style={text.body}>Istniejące daty i szkice zostaną pominięte. Przy nakładaniu cykli pierwszeństwo ma plan zapisany na konkretną datę, a potem cykl z późniejszą datą początkową.</Text>
          <View style={styles.previewActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: disabled || available === 0 }}
              disabled={disabled || available === 0}
              onPress={() => { void run(confirmImport); }}
              style={({ pressed }) => [styles.primaryBtn, (disabled || available === 0 || pressed) && styles.muted]}
            >
              <Text style={styles.primaryBtnText}>Dodaj plany</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => { setPending(null); setError(null); }}
              style={({ pressed }) => [styles.secondaryBtn, (disabled || pressed) && styles.muted]}
            >
              <Text style={styles.secondaryBtnText}>Anuluj import</Text>
            </Pressable>
          </View>
        </View>
      )}

      {busy && <Text accessibilityLiveRegion="polite" style={text.body}>Przetwarzam plik…</Text>}
      {notice && <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{notice}</Text>}
      {error && <Text accessibilityLiveRegion="polite" style={text.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.45)',
    ...shadows.card,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66, 71, 84, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  actionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.onSurfaceVariant,
  },
  previewCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.primaryContainer,
    gap: 10,
    ...shadows.card,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  previewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerHigh,
  },
  previewBadgeText: {
    fontFamily: fonts.clock,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.secondary,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  muted: {
    opacity: 0.7,
  },
});
